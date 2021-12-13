const os = require("os");
const fs = require("fs");

const actions = require("@actions/core");
const cache = require("@actions/tool-cache")

const { Octokit } = require("@octokit/rest");
const { throttling } = require("@octokit/plugin-throttling");

const decompress = require("decompress");
const decompressTarxz = require("@felipecrs/decompress-tarxz");

const OctokitImpl = Octokit.plugin(throttling);

const octokit = new OctokitImpl({
    throttle: {
        onRateLimit: (retryAfter, options) => {
            octokit.log.warn(
                `Request quota exhausted for request ${options.method} ${options.url}`
            );
            // Retry twice after hitting a rate limit error, then give up
            if (options.request.retryCount <= 2) {
                console.log(`Retrying after ${retryAfter} seconds!`);
                return true;
            }
        },
        onAbuseLimit: (retryAfter, options) => {
            // does not retry, only logs a warning
            octokit.log.warn(
                `Abuse detected for request ${options.method} ${options.url}`
            );
        },
    },
});

const osMap = {
    linux: "linux",
    darwin: "macos",
    win32: "windows",
};

const archMap = {
    x64: "x86_64",
    arm64: "aarch64",
};

function dive(dir, action) {
    if (typeof action !== "function")
        action = function (error, file) { };

    fs.readdir(dir, function (err, list) {
        if (err) return action(err);

        list.forEach(function (file) {
            const path = dir + "/" + file;

            fs.stat(path, function (err, stat) {
                if (stat && stat.isDirectory())
                    dive(path, action);
                else
                    action(null, path);
            });
        });
    });
};


// most @actions toolkit packages have async methods
async function run() {
    const latest_version = await octokit.repos.listReleases({ owner: "ziglang", repo: "zig" }).then(x => x.data[0].tag_name);
    const version = actions.getInput("version") || latest_version;
    const master_build = version.includes("-dev.");
    const folder = master_build ? "builds" : `download/${version}`;
    const the_os = osMap[os.platform()];
    const the_arch = archMap[os.arch()];
    const is_windows = the_os === "windows";
    const ext = is_windows ? "zip" : "tar.xz";

    const zig_folder = `zig-${the_os}-${the_arch}-${version}`;
    const zig_file = `${zig_folder}.${ext}`;
    const zig_url = `https://ziglang.org/${folder}/${zig_file}`;

    return Promise.resolve(zig_url)
        .then(x => cache.downloadTool(x))
        .then(x => decompress(x, zig_folder, { plugins: is_windows ? [] : [decompressTarxz()] }))
        .then(_ => cache.cacheDir(zig_folder, "zig", version))
        .then(x => actions.addPath(x))
        .then(_ => {
            dive(".", (path) => console.log(path));
        })
        .catch(err => actions.error(err));
}

run();
