export function ok(data = null, message = undefined) {
    const res = { success: true };
    if (message) res.message = message;
    if (data !== null) res.data = data;
    return res;
}

export function fail(message, data = undefined) {
    const res = { success: false, message };
    if (data !== undefined) res.data = data;
    return res;
}