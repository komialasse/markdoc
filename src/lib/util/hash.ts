const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const idLen = 5;
export function getHash() {
    if (!window.location.hash) {
        let hash = "";
        for (let i = 0; i < idLen; i++) {
            hash += chars[Math.floor(Math.random() * chars.length)]
        }
        window.history.replaceState(null, "", "#" + hash)
    }
    return window.location.hash.slice(1);
}
