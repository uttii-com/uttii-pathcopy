/* SPDX-FileCopyrightText: 2026 uttii-com <https://uttii.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
(function () {
    "use strict";
    console.log("[PathCopy] Initializing PathCopy extension...");

    let lang = "ja";
    try {
        const loaded = window.OC?.InitialState?.loadState("pathcopy", "lang");
        if (loaded === "en" || loaded === "ja") {
            lang = loaded;
        }
    } catch (e) {}

    const I18N = {
        ja: {
            copySingle: "📋 パスをコピー",
            copyMulti: (n) => "📋 " + n + " 件のパスをコピー",
            copiedSingle: (p) => "パスをコピーしました: " + p,
            copiedMulti: (n) => n + " 件のパスをコピーしました",
            copyFailed: "クリップボードへのコピーに失敗しました。"
        },
        en: {
            copySingle: "📋 Copy path",
            copyMulti: (n) => "📋 Copy " + n + " paths",
            copiedSingle: (p) => "Path copied: " + p,
            copiedMulti: (n) => n + " paths copied",
            copyFailed: "Failed to copy to clipboard."
        }
    };

    const t = I18N[lang] || I18N.ja;

    const iconCopy = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19 21H8V7h11m0-2H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2m-3-4H4a2 2 0 0 0-2 2v14h2V3h12V1Z"/></svg>';

    async function loadRegisterFileAction() {
        const findInModule = (mod) => {
            if (!mod || typeof mod !== "object") return null;
            for (const val of Object.values(mod)) {
                if (typeof val === "function") {
                    const src = Function.prototype.toString.call(val);
                    if (
                        (src.includes("register:action") && src.includes("fileActions")) ||
                        src.includes("_nc_fileactions") ||
                        src.includes("Invalid file action")
                    ) {
                        return { registerFileAction: val };
                    }
                }
            }
            return null;
        };

        const scanLoadedChunks = async () => {
            const resources = performance.getEntriesByType("resource");
            const candidates = [...new Set(
                resources
                    .map((r) => r.name)
                    .filter((name) => name.includes("/dist/") && name.endsWith(".chunk.mjs"))
            )];
            for (const url of candidates) {
                try {
                    const mod = await import(url);
                    const found = findInModule(mod);
                    if (found) return found;
                } catch (ignored) {}
            }
            return null;
        };

        const registerViaScope = () => {
            const root = window._nc_files_scope;
            if (!root || typeof root !== "object") return null;
            const scope =
                root.v4_0 ||
                Object.values(root).find(
                    (s) => s && typeof s === "object" && (s.registry || s.fileActions)
                );
            if (!scope) return null;
            return {
                registerFileAction: (action) => {
                    if (!action || typeof action.id !== "string" || !action.id) {
                        throw new Error("Invalid id");
                    }
                    if (!(scope.fileActions instanceof Map)) {
                        scope.fileActions = new Map();
                    }
                    if (scope.fileActions.has(action.id)) return;
                    scope.fileActions.set(action.id, action);
                    if (scope.registry && typeof scope.registry.dispatchEvent === "function") {
                        scope.registry.dispatchEvent(
                            new CustomEvent("register:action", { detail: action })
                        );
                    }
                }
            };
        };

        for (let attempt = 0; attempt < 20; attempt++) {
            const found = await scanLoadedChunks();
            if (found) return found;
            const fallback = registerViaScope();
            if (fallback) return fallback;
            await new Promise((r) => setTimeout(r, 100));
        }
        return null;
    }

    async function copyToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch (e) {
                console.warn("[PathCopy] navigator.clipboard.writeText failed, using fallback:", e);
            }
        }
        try {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.left = "-999999px";
            textArea.style.top = "-999999px";
            textArea.setAttribute("readonly", "");
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            const successful = document.execCommand("copy");
            document.body.removeChild(textArea);
            return successful;
        } catch (err) {
            console.error("[PathCopy] execCommand fallback failed:", err);
            return false;
        }
    }

    function getNodePath(node) {
        if (node.path) {
            return node.path.startsWith("/") ? node.path : "/" + node.path;
        }
        const dir = (node.dirname || "").replace(/\/$/, "");
        const name = node.basename || node.name || "";
        const full = dir + "/" + name;
        return full.startsWith("/") ? full : "/" + full;
    }

    async function handleCopyPath(nodes) {
        if (!nodes || nodes.length === 0) return false;
        const paths = nodes.map(getNodePath);
        const textToCopy = paths.join("\n");
        const ok = await copyToClipboard(textToCopy);
        if (ok) {
            const msg = paths.length === 1 ? t.copiedSingle(paths[0]) : t.copiedMulti(paths.length);
            if (OC.Notification?.showTemporary) {
                OC.Notification.showTemporary(msg);
            } else {
                console.log("[PathCopy]", msg);
            }
            return true;
        } else {
            alert(t.copyFailed);
            return false;
        }
    }

    async function init() {
        const api = await loadRegisterFileAction();
        if (!api || typeof api.registerFileAction !== "function") {
            console.error("[PathCopy] registerFileAction not found.");
            return;
        }
        api.registerFileAction({
            id: "pathcopy-action",
            displayName: ({ nodes }) => {
                if (nodes && nodes.length > 1) {
                    return t.copyMulti(nodes.length);
                }
                return t.copySingle;
            },
            iconSvgInline: () => iconCopy,
            order: 40,
            enabled({ nodes, view }) {
                if (view?.id === "trashbin") return false;
                return nodes && nodes.length >= 1;
            },
            async exec({ nodes }) {
                return await handleCopyPath(nodes);
            },
            async execBatch({ nodes }) {
                const res = await handleCopyPath(nodes);
                return Array(nodes.length).fill(res);
            }
        });
        console.log("[PathCopy] Registered 'Copy path' action successfully (lang=" + lang + ").");
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
