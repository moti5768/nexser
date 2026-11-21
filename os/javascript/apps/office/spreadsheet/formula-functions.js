// formula-functions.js
// Excel準拠の数式関数ライブラリ・演算ヘルパー・日付シリアル変換

export const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);

export function dateToSerial(dateObj) {
    const utc = Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
    return Math.round((utc - EXCEL_EPOCH_MS) / 86400000);
}

export function serialToDate(serial) {
    const d = new Date(EXCEL_EPOCH_MS + Math.round(Number(serial)) * 86400000);
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function tryParseDateToSerial(str) {
    const m = String(str ?? "").trim().match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (!m) return null;
    const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(dt.getTime()) ? null : dateToSerial(dt);
}

export const EXCEL_BLANK_CELL = Object.freeze({
    isBlank: true,
    valueOf() { return 0; },
    toString() { return ""; },
    [Symbol.toPrimitive](hint) { return hint === "string" ? "" : 0; }
});

export function unwrapBlank(v) {
    return (v && typeof v === "object" && v.isBlank) ? "" : v;
}

export function isBlankVal(v) {
    return v === "" || v == null || Boolean(v && typeof v === "object" && v.isBlank);
}

export function excelEquals(a, b) {
    const va = unwrapBlank(a);
    const vb = unwrapBlank(b);
    if (va === "" || vb === "") return va === "" && vb === "";
    if (typeof va === "number" && typeof vb === "number") return va === vb;
    if (typeof va === "boolean" || typeof vb === "boolean") return Boolean(va) === Boolean(vb);
    return String(va).toLowerCase() === String(vb).toLowerCase();
}

export function excelOpEquals(a, b) {
    const aBlank = Boolean(a && typeof a === "object" && a.isBlank);
    const bBlank = Boolean(b && typeof b === "object" && b.isBlank);
    if (aBlank && bBlank) return true;
    if (aBlank) return b === "" || b === 0 || b === false;
    if (bBlank) return a === "" || a === 0 || a === false;
    if (typeof a === "number" && typeof b === "number") return a === b;
    if (typeof a === "boolean" && typeof b === "boolean") return a === b;
    if (typeof a === "string" && typeof b === "string") return a.toLowerCase() === b.toLowerCase();
    return false;
}

export function parseExcelDate(input) {
    const val = unwrapBlank(input);
    if (val instanceof Date && !isNaN(val.getTime())) return val;
    if (typeof val === "number" && isFinite(val)) {
        const totalMs = Math.round(val * 86400000);
        const d = new Date(Date.UTC(1899, 11, 30) + totalMs);
        return new Date(
            d.getUTCFullYear(),
            d.getUTCMonth(),
            d.getUTCDate(),
            d.getUTCHours(),
            d.getUTCMinutes(),
            d.getUTCSeconds()
        );
    }
    const str = String(val ?? "").trim();
    if (!str) return null;
    const m = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
    if (m) {
        return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0));
    }
    const parsed = new Date(str);
    return isNaN(parsed.getTime()) ? null : parsed;
}

export function flattenArray(arr) {
    if (!Array.isArray(arr)) return [arr];
    return arr.reduce((acc, val) => acc.concat(Array.isArray(val) ? flattenArray(val) : val), []);
}

export function to2DArray(val) {
    if (!Array.isArray(val)) return [[val]];
    if (val.length === 0) return [[]];
    return Array.isArray(val[0]) ? val : val.map(v => [v]);
}

export function coerceExcelNum(v) {
    const uv = unwrapBlank(v);
    if (typeof uv === "boolean") return uv ? 1 : 0;
    if (uv === "" || uv == null) return 0;
    const n = Number(uv);
    return isNaN(n) ? NaN : n;
}

export function excelUnaryOp(op, a) {
    const applyOne = (v) => {
        if (typeof v === "string" && EXCEL_ERROR_RE.test(v.trim())) return v.trim();
        if (op === "!") return !Boolean(unwrapBlank(v));
        const n = coerceExcelNum(v);
        if (Number.isNaN(n)) return "#VALUE!";
        if (op === "-") return -n;
        if (op === "+") return +n;
        return n;
    };
    if (Array.isArray(a)) {
        return to2DArray(a).map(row => row.map(applyOne));
    }
    return applyOne(a);
}

export function excelBinaryOp(op, a, b) {
    const applyOne = (va, vb) => {
        if (typeof va === "string" && EXCEL_ERROR_RE.test(va.trim())) return va.trim();
        if (typeof vb === "string" && EXCEL_ERROR_RE.test(vb.trim())) return vb.trim();
        if (op === "==") return excelOpEquals(va, vb);
        if (op === "!=") return !excelOpEquals(va, vb);
        if (op === "<" || op === "<=" || op === ">" || op === ">=") {
            const ua = unwrapBlank(va);
            const ub = unwrapBlank(vb);
            const na = (ua === "" || ua == null) ? 0 : (typeof ua === "number" ? ua : NaN);
            const nb = (ub === "" || ub == null) ? 0 : (typeof ub === "number" ? ub : NaN);
            let cmp;
            if (!Number.isNaN(na) && !Number.isNaN(nb)) {
                cmp = na - nb;
            } else if (typeof ua === "string" && typeof ub === "string") {
                const la = ua.toLowerCase();
                const lb = ub.toLowerCase();
                cmp = la < lb ? -1 : (la > lb ? 1 : 0);
            } else {
                const rank = (x) => typeof x === "boolean" ? 3 : (typeof x === "string" && x !== "" ? 2 : 1);
                cmp = rank(ua) - rank(ub);
            }
            if (op === "<") return cmp < 0;
            if (op === "<=") return cmp <= 0;
            if (op === ">") return cmp > 0;
            return cmp >= 0;
        }
        const na = coerceExcelNum(va);
        const nb = coerceExcelNum(vb);
        if (Number.isNaN(na) || Number.isNaN(nb)) return "#VALUE!";
        if (op === "+") return na + nb;
        if (op === "-") return na - nb;
        if (op === "*") return na * nb;
        if (op === "/") return nb === 0 ? "#DIV/0!" : na / nb;
        if (op === "**") return Math.pow(na, nb);
        return "#VALUE!";
    };

    if (!Array.isArray(a) && !Array.isArray(b)) {
        return applyOne(a, b);
    }
    const ma = to2DArray(a);
    const mb = to2DArray(b);
    const rows = Math.max(ma.length, mb.length);
    const cols = Math.max(ma[0]?.length || 1, mb[0]?.length || 1);
    const out = [];
    for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) {
            const va = ma[ma.length === 1 ? 0 : r]?.[ma[0].length === 1 ? 0 : c];
            const vb = mb[mb.length === 1 ? 0 : r]?.[mb[0].length === 1 ? 0 : c];
            if (va === undefined || vb === undefined) {
                row.push("#N/A");
            } else {
                row.push(applyOne(va, vb));
            }
        }
        out.push(row);
    }
    return out;
}

export function buildWildcardRegex(pattern) {
    const escaped = String(pattern)
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*")
        .replace(/\?/g, ".");
    return new RegExp(`^${escaped}$`, "i");
}

export function buildConditionMatcher(condition) {
    const condStr = String(unwrapBlank(condition) ?? "").trim();
    const match = condStr.match(/^(>=|<=|<>|!=|>|<|=)(.*)$/);

    if (match) {
        const op = match[1];
        const rawTarget = match[2].trim();

        // Excel仕様: "=" は空白セルのみ、"<>" は空白以外（数値0も含む）に一致
        if (rawTarget === "") {
            if (op === "=") return (v) => isBlankVal(v);
            if (op === "<>" || op === "!=") return (v) => !isBlankVal(v);
        }

        const numTarget = Number(rawTarget);
        const isNum = rawTarget !== "" && !isNaN(numTarget);
        const hasWildcard = !isNum && (op === "=" || op === "<>" || op === "!=") && /[*?]/.test(rawTarget);
        const wcRegex = hasWildcard ? buildWildcardRegex(rawTarget) : null;
        const lowerTarget = rawTarget.toLowerCase();

        return (rawV) => {
            const v = unwrapBlank(rawV);
            const blank = v === "" || v == null;
            const isBool = typeof v === "boolean";
            const numVal = (!blank && !isBool && !isNaN(Number(v))) ? Number(v) : NaN;
            const vIsNum = !isNaN(numVal);

            // 大小比較 (<, <=, >, >=) は空白や異型データを除外（Excel準拠）
            if (op === ">" || op === ">=" || op === "<" || op === "<=") {
                if (blank || isBool) return false;
                if (isNum) {
                    if (!vIsNum) return false;
                    if (op === ">") return numVal > numTarget;
                    if (op === ">=") return numVal >= numTarget;
                    if (op === "<") return numVal < numTarget;
                    return numVal <= numTarget;
                }
                if (vIsNum) return false;
                const lv = String(v).toLowerCase();
                if (op === ">") return lv > lowerTarget;
                if (op === ">=") return lv >= lowerTarget;
                if (op === "<") return lv < lowerTarget;
                return lv <= lowerTarget;
            }

            // 等価・不等価 (=, <>)
            let eq = false;
            if (wcRegex) {
                eq = !blank && wcRegex.test(String(v));
            } else if (isNum && vIsNum) {
                eq = numVal === numTarget;
            } else if (!blank) {
                eq = String(v).toLowerCase() === lowerTarget;
            }
            return (op === "<>" || op === "!=") ? !eq : eq;
        };
    }

    if (/[*?]/.test(condStr)) {
        const regex = buildWildcardRegex(condStr);
        return (v) => {
            const uv = unwrapBlank(v);
            return uv !== "" && uv != null && regex.test(String(uv));
        };
    }

    if (condStr === "") {
        return (v) => isBlankVal(v);
    }

    const numTarget = Number(condStr);
    const isNum = !isNaN(numTarget);
    const lowerCond = condStr.toLowerCase();
    return (rawV) => {
        const v = unwrapBlank(rawV);
        if (v === "" || v == null) return false;
        if (isNum && typeof v !== "boolean" && !isNaN(Number(v))) {
            return Number(v) === numTarget;
        }
        return String(v).toLowerCase() === lowerCond;
    };
}

export const EXCEL_ERROR_RE = /^#(ERROR!|DIV\/0!|N\/A|VALUE!|CIRCULAR!|REF!|NAME\?|NUM!|CALC!|SPILL!)$/;

export function collectNumericValues(args) {
    const flat = flattenArray(args);
    const nums = [];
    for (let i = 0; i < flat.length; i++) {
        const v = unwrapBlank(flat[i]);
        if (typeof v === "string" && EXCEL_ERROR_RE.test(v.trim())) {
            return { error: v.trim(), nums: [] };
        }
        if (v === "" || v == null || typeof v === "boolean") continue;
        const n = Number(v);
        if (Number.isFinite(n)) nums.push(n);
    }
    return { error: null, nums };
}

export function collectLogicalValues(args) {
    const vals = [];
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (Array.isArray(arg)) {
            const flat = flattenArray(arg);
            for (let j = 0; j < flat.length; j++) {
                const v = unwrapBlank(flat[j]);
                if (typeof v === "string" && EXCEL_ERROR_RE.test(v.trim())) {
                    return { error: v.trim(), vals: [] };
                }
                // Excel仕様: 範囲内の空白・文字列は無視
                if (v === "" || v == null || typeof v === "string") continue;
                if (typeof v === "boolean") vals.push(v);
                else if (typeof v === "number" && Number.isFinite(v)) vals.push(v !== 0);
            }
        } else {
            const v = unwrapBlank(arg);
            if (typeof v === "string" && EXCEL_ERROR_RE.test(v.trim())) {
                return { error: v.trim(), vals: [] };
            }
            if (v === "" || v == null) {
                if (arg && arg.isBlank) vals.push(false);
                else return { error: "#VALUE!", vals: [] };
            } else if (typeof v === "boolean") {
                vals.push(v);
            } else if (typeof v === "number" && Number.isFinite(v)) {
                vals.push(v !== 0);
            } else if (typeof v === "string") {
                const up = v.trim().toUpperCase();
                if (up === "TRUE") vals.push(true);
                else if (up === "FALSE") vals.push(false);
                else if (!isNaN(Number(up))) vals.push(Number(up) !== 0);
                else return { error: "#VALUE!", vals: [] };
            }
        }
    }
    if (!vals.length) return { error: "#VALUE!", vals: [] };
    return { error: null, vals };
}

export const FORMULA_FUNCTIONS = {
    SUM(...args) {
        const { error, nums } = collectNumericValues(args);
        if (error) return error;
        let total = 0;
        for (let i = 0; i < nums.length; i++) total += nums[i];
        return total;
    },
    AVERAGE(...args) {
        const { error, nums } = collectNumericValues(args);
        if (error) return error;
        if (nums.length === 0) return "#DIV/0!";
        let total = 0;
        for (let i = 0; i < nums.length; i++) total += nums[i];
        return total / nums.length;
    },
    MIN(...args) {
        const { error, nums } = collectNumericValues(args);
        if (error) return error;
        if (!nums.length) return 0;
        let min = nums[0];
        for (let i = 1; i < nums.length; i++) if (nums[i] < min) min = nums[i];
        return min;
    },
    MAX(...args) {
        const { error, nums } = collectNumericValues(args);
        if (error) return error;
        if (!nums.length) return 0;
        let max = nums[0];
        for (let i = 1; i < nums.length; i++) if (nums[i] > max) max = nums[i];
        return max;
    },
    COUNT(...args) {
        const flat = flattenArray(args);
        return flat.filter(x => typeof x !== "boolean" && String(x ?? "").trim() !== "" && !isNaN(Number(String(x).trim()))).length;
    },
    COUNTA(...args) {
        const flat = flattenArray(args);
        return flat.filter(x => String(x ?? "").trim() !== "").length;
    },
    PRODUCT(...args) {
        const { error, nums } = collectNumericValues(args);
        if (error) return error;
        if (!nums.length) return 0;
        return nums.reduce((acc, v) => acc * v, 1);
    },
    ADD(a, b) { return Number(a) + Number(b); },
    SUBTRACT(a, b) { return Number(a) - Number(b); },
    DIVIDE(a, b) { return Number(b) !== 0 ? Number(a) / Number(b) : "#DIV/0!"; },
    POWER(a, b) { return Math.pow(Number(a), Number(b)); },
    SQRT(a) { return Math.sqrt(Number(a)); },
    MOD(a, b) {
        const n = Number(unwrapBlank(a));
        const d = Number(unwrapBlank(b));
        if (!Number.isFinite(n) || !Number.isFinite(d)) return "#VALUE!";
        if (d === 0) return "#DIV/0!";
        return n - d * Math.floor(n / d);
    },
    ABS(a) { return Math.abs(Number(a)); },
    ROUND(num, digits = 0) {
        const n = Number(unwrapBlank(num)), d = Math.trunc(Number(unwrapBlank(digits)));
        if (!isFinite(n) || isNaN(d)) return "#VALUE!";
        const factor = Math.pow(10, d);
        return Math.sign(n) * Math.round((Math.abs(n) + Number.EPSILON) * factor) / factor;
    },
    ROUNDUP(num, digits = 0) {
        const n = Number(unwrapBlank(num)), d = Math.trunc(Number(unwrapBlank(digits)));
        if (!isFinite(n) || isNaN(d)) return "#VALUE!";
        const factor = Math.pow(10, d);
        const shifted = Number((n * factor).toPrecision(15));
        return (n >= 0 ? Math.ceil(shifted) : Math.floor(shifted)) / factor;
    },
    ROUNDDOWN(num, digits = 0) {
        const n = Number(unwrapBlank(num)), d = Math.trunc(Number(unwrapBlank(digits)));
        if (!isFinite(n) || isNaN(d)) return "#VALUE!";
        const factor = Math.pow(10, d);
        const shifted = Number((n * factor).toPrecision(15));
        return Math.trunc(shifted) / factor;
    },

    SUMIF(range, condition, sumRange = null) {
        const arr = flattenArray(range);
        const targets = sumRange != null ? flattenArray(sumRange) : arr;
        const matchFn = buildConditionMatcher(condition);
        return arr.reduce((sum, v, idx) => {
            if (!matchFn(v)) return sum;
            const raw = unwrapBlank(targets[idx]);
            const num = (raw !== "" && raw != null && typeof raw !== "boolean") ? Number(raw) : NaN;
            return isFinite(num) ? sum + num : sum;
        }, 0);
    },
    AVERAGEIF(range, condition, avgRange = null) {
        const arr = flattenArray(range);
        const targets = avgRange != null ? flattenArray(avgRange) : arr;
        const matchFn = buildConditionMatcher(condition);
        const filtered = [];
        arr.forEach((v, idx) => {
            if (!matchFn(v)) return;
            const raw = unwrapBlank(targets[idx]);
            const num = (raw !== "" && raw != null && typeof raw !== "boolean") ? Number(raw) : NaN;
            if (isFinite(num)) filtered.push(num);
        });
        if (filtered.length === 0) return "#DIV/0!";
        return filtered.reduce((a, b) => a + b, 0) / filtered.length;
    },
    COUNTIF(range, condition) {
        const arr = flattenArray(range);
        const matchFn = buildConditionMatcher(condition);
        return arr.filter(v => matchFn(v)).length;
    },

    CONCAT(...args) {
        const flat = flattenArray(args);
        for (let i = 0; i < flat.length; i++) {
            const v = unwrapBlank(flat[i]);
            if (typeof v === "string" && EXCEL_ERROR_RE.test(v.trim())) return v.trim();
        }
        return flat.map(v => String(unwrapBlank(v) ?? "")).join("");
    },
    UPPER(text) { return String(text).toUpperCase(); },
    LOWER(text) { return String(text).toLowerCase(); },
    LEFT(text, count = 1) {
        const cnt = Math.trunc(Number(unwrapBlank(count)));
        if (isNaN(cnt) || cnt < 0) return "#VALUE!";
        return String(unwrapBlank(text) ?? "").substring(0, cnt);
    },
    RIGHT(text, count = 1) {
        const cnt = Math.trunc(Number(unwrapBlank(count)));
        if (isNaN(cnt) || cnt < 0) return "#VALUE!";
        if (cnt === 0) return "";
        return String(unwrapBlank(text) ?? "").slice(-cnt);
    },
    MID(text, start, count) {
        const st = Math.trunc(Number(unwrapBlank(start)));
        const cnt = Math.trunc(Number(unwrapBlank(count)));
        if (isNaN(st) || isNaN(cnt) || st < 1 || cnt < 0) return "#VALUE!";
        return String(unwrapBlank(text) ?? "").slice(st - 1, st - 1 + cnt);
    },
    TRIM(text) { return String(unwrapBlank(text) ?? "").trim().replace(/\s+/g, " "); },
    LEN(text) { return String(unwrapBlank(text) ?? "").length; },
    FIND(findText, withinText, startNum = 1) {
        const st = Math.trunc(Number(unwrapBlank(startNum)));
        if (isNaN(st) || st < 1) return "#VALUE!";
        const idx = String(unwrapBlank(withinText) ?? "").indexOf(String(unwrapBlank(findText) ?? ""), st - 1);
        return idx === -1 ? "#VALUE!" : idx + 1;
    },
    REPLACE(text, start, count, newText) {
        const s = String(text);
        const st = Number(start) - 1;
        const cnt = Number(count);
        return s.substring(0, st) + newText + s.substring(st + cnt);
    },

    IF(condition, trueValue, falseValue = "") {
        const raw = unwrapBlank(condition);
        const cond = typeof raw === "string"
            ? raw.trim().toUpperCase() === "TRUE"
            : Boolean(raw);
        return cond ? trueValue : falseValue;
    },
    IFERROR(value, valueIfError = "") {
        const raw = unwrapBlank(value);
        if (typeof raw === "string" && /^#(ERROR!|DIV\/0!|N\/A|VALUE!|CIRCULAR!|REF!|NAME\?|NUM!|CALC!|SPILL!)$/.test(raw.trim())) {
            return valueIfError;
        }
        if (typeof raw === "number" && (!isFinite(raw) || isNaN(raw))) {
            return valueIfError;
        }
        return value;
    },
    AND(...args) {
        const { error, vals } = collectLogicalValues(args);
        if (error) return error;
        return vals.every(Boolean);
    },
    OR(...args) {
        const { error, vals } = collectLogicalValues(args);
        if (error) return error;
        return vals.some(Boolean);
    },
    NOT(value) {
        const { error, vals } = collectLogicalValues([value]);
        if (error) return error;
        return !vals[0];
    },

    INDEX(array, row = 0, col = 0) {
        if (!Array.isArray(array)) return array;
        const rNum = Math.trunc(Number(unwrapBlank(row) || 0));
        const cNum = Math.trunc(Number(unwrapBlank(col) || 0));
        if (isNaN(rNum) || isNaN(cNum) || rNum < 0 || cNum < 0) return "#VALUE!";
        if (Array.isArray(array[0])) {
            if (rNum === 0 && cNum === 0) return array;
            if (rNum === 0) {
                if (cNum > array[0].length) return "#REF!";
                return array.map(r => [r[cNum - 1] ?? ""]);
            }
            if (cNum === 0) {
                if (rNum > array.length) return "#REF!";
                return [array[rNum - 1]];
            }
            if (rNum > array.length || cNum > array[0].length) return "#REF!";
            const val = array[rNum - 1][cNum - 1];
            return isBlankVal(val) ? 0 : val;
        }
        if (rNum === 0) return array;
        if (rNum > array.length) return "#REF!";
        return isBlankVal(array[rNum - 1]) ? 0 : array[rNum - 1];
    },
    MATCH(lookupValue, array, matchType = 1) {
        const flat = flattenArray(array);
        const lv = unwrapBlank(lookupValue);
        const mt = Math.trunc(Number(unwrapBlank(matchType)));
        if (isNaN(mt)) return "#VALUE!";

        if (mt === 0) {
            const wc = typeof lv === "string" && /[*?]/.test(lv) ? buildWildcardRegex(lv) : null;
            const found = flat.findIndex(raw => {
                const v = unwrapBlank(raw);
                if (v === "" || v == null) return false;
                return wc ? wc.test(String(v)) : excelEquals(v, lv);
            });
            return found !== -1 ? found + 1 : "#N/A";
        }

        const cmpVal = (a, b) => {
            if (typeof a === "number" && typeof b === "number") return a - b;
            if (typeof a === "string" && typeof b === "string") {
                const la = a.toLowerCase(), lb = b.toLowerCase();
                return la < lb ? -1 : (la > lb ? 1 : 0);
            }
            return null;
        };

        if (mt === 1) {
            let idx = -1;
            for (let i = 0; i < flat.length; i++) {
                const v = unwrapBlank(flat[i]);
                if (v === "" || v == null) continue;
                const c = cmpVal(v, lv);
                if (c !== null && c <= 0) idx = i;
            }
            return idx !== -1 ? idx + 1 : "#N/A";
        }
        if (mt === -1) {
            let idx = -1;
            for (let i = 0; i < flat.length; i++) {
                const v = unwrapBlank(flat[i]);
                if (v === "" || v == null) continue;
                const c = cmpVal(v, lv);
                if (c !== null && c >= 0) idx = i;
            }
            return idx !== -1 ? idx + 1 : "#N/A";
        }
        return "#N/A";
    },
    VLOOKUP(lookupValue, tableArray, colIndex, rangeLookup = true) {
        const cIdx = Math.trunc(Number(unwrapBlank(colIndex)));
        if (!Array.isArray(tableArray) || isNaN(cIdx) || cIdx < 1) return "#VALUE!";
        const lv = unwrapBlank(lookupValue);
        const isRangeLookup = typeof rangeLookup === "string"
            ? !["FALSE", "0"].includes(rangeLookup.trim().toUpperCase())
            : Boolean(rangeLookup);
        const wildcardMatcher = (!isRangeLookup && typeof lv === "string" && /[*?]/.test(lv))
            ? buildConditionMatcher(lv)
            : null;
        let bestMatch = null;
        for (const row of tableArray) {
            if (!Array.isArray(row) || isBlankVal(row[0])) continue;
            if (cIdx > row.length) return "#REF!";
            const cellVal = unwrapBlank(row[0]);
            const retVal = isBlankVal(row[cIdx - 1]) ? 0 : unwrapBlank(row[cIdx - 1]);
            if (isRangeLookup) {
                if (typeof cellVal === typeof lv && cellVal <= lv) {
                    bestMatch = retVal;
                }
            } else if (wildcardMatcher ? wildcardMatcher(cellVal) : excelEquals(cellVal, lv)) {
                return retVal;
            }
        }
        return bestMatch !== null ? bestMatch : "#N/A";
    },
    HLOOKUP(lookupValue, tableArray, rowIndex, rangeLookup = true) {
        const rIdx = Math.trunc(Number(rowIndex));
        if (!Array.isArray(tableArray) || !Array.isArray(tableArray[0]) || isNaN(rIdx) || rIdx < 1) return "#VALUE!";
        const isRangeLookup = typeof rangeLookup === "string"
            ? !["FALSE", "0"].includes(rangeLookup.trim().toUpperCase())
            : Boolean(rangeLookup);
        const headerRow = tableArray[0];
        let bestMatch = null;
        for (let c = 0; c < headerRow.length; c++) {
            if (isBlankVal(headerRow[c])) continue;
            if (isRangeLookup) {
                if (headerRow[c] <= lookupValue) {
                    bestMatch = tableArray[rIdx - 1]?.[c] ?? "#REF!";
                }
            } else {
                if (excelEquals(headerRow[c], lookupValue)) return tableArray[rIdx - 1]?.[c] ?? "#REF!";
            }
        }
        return bestMatch !== null ? bestMatch : "#N/A";
    },
    XLOOKUP(lookupValue, lookupArray, returnArray, ifNotFound = "#N/A") {
        const keys = flattenArray(lookupArray);
        const vals = flattenArray(returnArray);
        const idx = keys.findIndex(v => excelEquals(v, lookupValue));
        return idx !== -1 ? (vals[idx] ?? ifNotFound) : ifNotFound;
    },
    SUMIFS(sumRange, ...criteriaPairs) {
        const targets = flattenArray(sumRange);
        const matchers = [];
        for (let i = 0; i < criteriaPairs.length; i += 2) {
            matchers.push({ arr: flattenArray(criteriaPairs[i]), fn: buildConditionMatcher(criteriaPairs[i + 1]) });
        }
        return targets.reduce((sum, val, idx) => {
            if (!matchers.every(m => m.fn(m.arr[idx]))) return sum;
            const raw = unwrapBlank(val);
            const num = (raw !== "" && raw != null && typeof raw !== "boolean") ? Number(raw) : NaN;
            return isFinite(num) ? sum + num : sum;
        }, 0);
    },
    COUNTIFS(...criteriaPairs) {
        if (criteriaPairs.length < 2) return 0;
        const matchers = [];
        for (let i = 0; i < criteriaPairs.length; i += 2) {
            matchers.push({ arr: flattenArray(criteriaPairs[i]), fn: buildConditionMatcher(criteriaPairs[i + 1]) });
        }
        const len = matchers[0].arr.length;
        let count = 0;
        for (let idx = 0; idx < len; idx++) {
            if (matchers.every(m => m.fn(m.arr[idx]))) count++;
        }
        return count;
    },
    INT(num) { return Math.floor(Number(num)); },
    SUBSTITUTE(text, oldText, newText, instanceNum = null) {
        const src = String(unwrapBlank(text) ?? "");
        const oldStr = String(unwrapBlank(oldText) ?? "");
        const newStr = String(unwrapBlank(newText) ?? "");
        if (oldStr === "") return src;
        if (instanceNum == null || isBlankVal(instanceNum)) {
            return src.split(oldStr).join(newStr);
        }
        const targetIdx = Math.trunc(Number(unwrapBlank(instanceNum)));
        if (isNaN(targetIdx) || targetIdx < 1) return "#VALUE!";
        let count = 0;
        let pos = 0;
        while ((pos = src.indexOf(oldStr, pos)) !== -1) {
            count++;
            if (count === targetIdx) {
                return src.slice(0, pos) + newStr + src.slice(pos + oldStr.length);
            }
            pos += oldStr.length;
        }
        return src;
    },
    ISBLANK(val) { return isBlankVal(val); },
    ISNUMBER(val) {
        const v = unwrapBlank(val);
        return v !== "" && v != null && typeof v !== "boolean" && !isNaN(Number(v));
    },

    DATE(year, month, day) { return new Date(Number(year), Number(month) - 1, Number(day)); },
    TODAY() { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), now.getDate()); },
    NOW() { return new Date(); },
    YEAR(dateInput) { const d = parseExcelDate(dateInput); return d ? d.getFullYear() : "#VALUE!"; },
    MONTH(dateInput) { const d = parseExcelDate(dateInput); return d ? d.getMonth() + 1 : "#VALUE!"; },
    DAY(dateInput) { const d = parseExcelDate(dateInput); return d ? d.getDate() : "#VALUE!"; },
    HOUR(dateInput) { const d = parseExcelDate(dateInput); return d ? d.getHours() : "#VALUE!"; },
    MINUTE(dateInput) { const d = parseExcelDate(dateInput); return d ? d.getMinutes() : "#VALUE!"; },
    SECOND(dateInput) { const d = parseExcelDate(dateInput); return d ? d.getSeconds() : "#VALUE!"; },
    WEEKDAY(dateInput, returnType = 1) {
        const d = parseExcelDate(dateInput);
        if (!d) return "#VALUE!";
        const day = d.getDay();
        if (Number(returnType) === 2) return day === 0 ? 7 : day;
        if (Number(returnType) === 3) return day === 0 ? 6 : day - 1;
        return day + 1;
    },
    DAYS(endDate, startDate) {
        const d1 = parseExcelDate(startDate), d2 = parseExcelDate(endDate);
        if (!d1 || !d2) return "#VALUE!";
        return Math.round((Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate()) - Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate())) / 86400000);
    },
    EDATE(dateInput, months) {
        const d = parseExcelDate(dateInput);
        const m = Math.trunc(Number(unwrapBlank(months)));
        if (!d || isNaN(m)) return "#VALUE!";
        const totalMonths = d.getFullYear() * 12 + d.getMonth() + m;
        const targetYear = Math.floor(totalMonths / 12);
        const targetMonth = ((totalMonths % 12) + 12) % 12;
        const lastDayOfTarget = new Date(targetYear, targetMonth + 1, 0).getDate();
        return new Date(targetYear, targetMonth, Math.min(d.getDate(), lastDayOfTarget));
    },
    EOMONTH(startDate, months) {
        const d = parseExcelDate(startDate);
        if (!d) return "#VALUE!";
        return new Date(d.getFullYear(), d.getMonth() + Number(months) + 1, 0);
    },
    DATEDIF(startDate, endDate, unit) {
        const d1 = parseExcelDate(startDate);
        const d2 = parseExcelDate(endDate);
        if (!d1 || !d2) return "#VALUE!";
        if (d1 > d2) return "#NUM!";
        const u = String(unwrapBlank(unit)).trim().toUpperCase();
        const totalDays = Math.floor((Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate()) - Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate())) / 86400000);
        if (u === "D") return totalDays;
        let years = d2.getFullYear() - d1.getFullYear();
        let months = d2.getMonth() - d1.getMonth();
        let days = d2.getDate() - d1.getDate();
        if (days < 0) {
            months -= 1;
            const prevMonthDays = new Date(d2.getFullYear(), d2.getMonth(), 0).getDate();
            days += prevMonthDays;
        }
        if (months < 0) {
            years -= 1;
            months += 12;
        }
        if (u === "Y") return years;
        if (u === "M") return years * 12 + months;
        if (u === "YM") return months;
        if (u === "MD") return days;
        if (u === "YD") {
            let targetYear = d1.getFullYear();
            let tmpUtc = Date.UTC(targetYear, d2.getMonth(), d2.getDate());
            const d1Utc = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
            if (tmpUtc < d1Utc) {
                targetYear += 1;
                tmpUtc = Date.UTC(targetYear, d2.getMonth(), d2.getDate());
            }
            return Math.round((tmpUtc - d1Utc) / 86400000);
        }
        return "#NUM!";
    },
    TIME(hour, minute, second) {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, second);
    },
    TIMEVALUE(timeStr) {
        const parts = String(timeStr).split(":");
        if (parts.length === 2 || parts.length === 3) {
            const h = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            const s = parts.length === 3 ? parseInt(parts[2], 10) : 0;
            return (h * 3600 + m * 60 + s) / 86400;
        }
        return "#VALUE!";
    },
    DATEVALUE(dateString) {
        const d = parseExcelDate(dateString);
        return d ? dateToSerial(d) : "#VALUE!";
    },
    IFS(...pairs) {
        for (let i = 0; i < pairs.length - 1; i += 2) {
            const cond = typeof pairs[i] === "string" ? pairs[i].trim().toUpperCase() === "TRUE" : Boolean(pairs[i]);
            if (cond) return pairs[i + 1];
        }
        return "#N/A";
    },
    SWITCH(expr, ...args) {
        for (let i = 0; i < args.length - 1; i += 2) {
            if (expr == args[i]) return args[i + 1];
        }
        return args.length % 2 === 1 ? args[args.length - 1] : "#N/A";
    },
    XOR(...args) {
        const { error, vals } = collectLogicalValues(args);
        if (error) return error;
        return vals.filter(Boolean).length % 2 === 1;
    },
    TEXTJOIN(delimiter, ignoreEmpty, ...texts) {
        const flat = flattenArray(texts).map(v => String(v ?? ""));
        const list = ignoreEmpty ? flat.filter(s => s.trim() !== "") : flat;
        return list.join(String(delimiter ?? ""));
    },
    TEXTSPLIT(text, colDelimiter = ",") {
        return String(text ?? "").split(String(colDelimiter));
    },
    CLEAN(text) {
        return String(text ?? "").replace(/[\x00-\x1F\x7F]/g, "");
    },
    NETWORKDAYS(startDate, endDate, holidays = null) {
        const s = parseExcelDate(startDate);
        const e = parseExcelDate(endDate);
        if (!s || !e) return "#VALUE!";
        const holidaySet = new Set();
        if (holidays != null) {
            flattenArray([holidays]).forEach(h => {
                const hd = parseExcelDate(h);
                if (hd) holidaySet.add(`${hd.getFullYear()}-${hd.getMonth()}-${hd.getDate()}`);
            });
        }
        const cur = new Date(s.getFullYear(), s.getMonth(), s.getDate());
        const end = new Date(e.getFullYear(), e.getMonth(), e.getDate());
        const step = cur <= end ? 1 : -1;
        let count = 0;
        while ((step > 0 && cur <= end) || (step < 0 && cur >= end)) {
            const day = cur.getDay();
            const key = `${cur.getFullYear()}-${cur.getMonth()}-${cur.getDate()}`;
            if (day !== 0 && day !== 6 && !holidaySet.has(key)) count += step;
            cur.setDate(cur.getDate() + step);
        }
        return count;
    },
    WORKDAY(startDate, days, holidays = null) {
        const base = parseExcelDate(startDate);
        const remNum = Math.trunc(Number(unwrapBlank(days)));
        if (!base || isNaN(remNum)) return "#VALUE!";
        const holidaySet = new Set();
        if (holidays != null) {
            flattenArray([holidays]).forEach(h => {
                const hd = parseExcelDate(h);
                if (hd) holidaySet.add(`${hd.getFullYear()}-${hd.getMonth()}-${hd.getDate()}`);
            });
        }
        const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
        let rem = remNum;
        const step = rem >= 0 ? 1 : -1;
        while (rem !== 0) {
            d.setDate(d.getDate() + step);
            const day = d.getDay();
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            if (day !== 0 && day !== 6 && !holidaySet.has(key)) rem -= step;
        }
        return d;
    },
    XMATCH(lookupValue, lookupArray) {
        const idx = flattenArray(lookupArray).findIndex(v => excelEquals(v, lookupValue));
        return idx !== -1 ? idx + 1 : "#N/A";
    },
    FILTER(array, include, ifEmpty = "#CALC!") {
        const rows = Array.isArray(array) ? array : [[array]];
        const flags = flattenArray(include);
        const out = rows.filter((_, i) => Boolean(flags[i]));
        return out.length ? out : ifEmpty;
    },
    UNIQUE(array) {
        return Array.from(new Set(flattenArray(array)));
    },
    CHOOSECOLS(array, ...colNums) {
        if (!Array.isArray(array)) return array;
        return array.map(r => Array.isArray(r) ? colNums.map(c => r[Number(c) - 1] ?? "") : r);
    },
    CHOOSEROWS(array, ...rowNums) {
        if (!Array.isArray(array)) return array;
        return rowNums.map(r => array[Number(r) - 1] ?? []);
    },
    AVERAGEIFS(avgRange, ...criteriaPairs) {
        const targets = flattenArray(avgRange);
        const matchers = [];
        for (let i = 0; i < criteriaPairs.length; i += 2) {
            matchers.push({ arr: flattenArray(criteriaPairs[i]), fn: buildConditionMatcher(criteriaPairs[i + 1]) });
        }
        const vals = [];
        targets.forEach((t, idx) => {
            if (!matchers.every(m => m.fn(m.arr[idx]))) return;
            const raw = unwrapBlank(t);
            const num = (raw !== "" && raw != null && typeof raw !== "boolean") ? Number(raw) : NaN;
            if (isFinite(num)) vals.push(num);
        });
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : "#DIV/0!";
    },
    MEDIAN(...args) {
        const { error, nums } = collectNumericValues(args);
        if (error) return error;
        if (!nums.length) return "#NUM!";
        nums.sort((a, b) => a - b);
        const mid = Math.floor(nums.length / 2);
        return nums.length % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid];
    },
    STDEV(...args) {
        const { error, nums } = collectNumericValues(args);
        if (error) return error;
        if (nums.length < 2) return "#DIV/0!";
        const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
        const variance = nums.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (nums.length - 1);
        return Math.sqrt(variance);
    },
    SUBTOTAL(funcNum, ...refs) {
        const code = Number(funcNum) % 100;
        if (code === 1) return FORMULA_FUNCTIONS.AVERAGE(...refs);
        if (code === 2) return FORMULA_FUNCTIONS.COUNT(...refs);
        if (code === 3) return FORMULA_FUNCTIONS.COUNTA(...refs);
        if (code === 4) return FORMULA_FUNCTIONS.MAX(...refs);
        if (code === 5) return FORMULA_FUNCTIONS.MIN(...refs);
        if (code === 6) return FORMULA_FUNCTIONS.PRODUCT(...refs);
        if (code === 9) return FORMULA_FUNCTIONS.SUM(...refs);
        return "#VALUE!";
    },
    AGGREGATE(funcNum, _options, ...refs) {
        const clean = flattenArray(refs).filter(v => !(typeof v === "string" && v.startsWith("#")));
        return FORMULA_FUNCTIONS.SUBTOTAL(funcNum, clean);
    },
    SEQUENCE(rows = 1, cols = 1, start = 1, step = 1) {
        const rCnt = Math.trunc(Number(unwrapBlank(rows)));
        const cCnt = Math.trunc(Number(unwrapBlank(cols)));
        if (isNaN(rCnt) || isNaN(cCnt) || rCnt < 1 || cCnt < 1) return "#VALUE!";
        if (rCnt * cCnt > 50000) return "#NUM!";
        const out = [];
        let cur = Number(unwrapBlank(start));
        const st = Number(unwrapBlank(step));
        for (let r = 0; r < rCnt; r++) {
            const row = [];
            for (let c = 0; c < cCnt; c++) {
                row.push(cur);
                cur += st;
            }
            out.push(row);
        }
        return out;
    },
    RANDARRAY(rows = 1, cols = 1, min = 0, max = 1, wholeNumber = false) {
        const rCnt = Math.trunc(Number(unwrapBlank(rows)));
        const cCnt = Math.trunc(Number(unwrapBlank(cols)));
        if (isNaN(rCnt) || isNaN(cCnt) || rCnt < 1 || cCnt < 1) return "#VALUE!";
        if (rCnt * cCnt > 50000) return "#NUM!";
        const lo = Number(unwrapBlank(min));
        const hi = Number(unwrapBlank(max));
        if (lo > hi) return "#VALUE!";
        const out = [];
        for (let r = 0; r < rCnt; r++) {
            const row = [];
            for (let c = 0; c < cCnt; c++) {
                const v = lo + Math.random() * (hi - lo);
                row.push(wholeNumber ? Math.floor(lo + Math.random() * (hi - lo + 1)) : v);
            }
            out.push(row);
        }
        return out;
    },
    ISTEXT(val) {
        const v = unwrapBlank(val);
        return typeof v === "string" && v !== "" && !EXCEL_ERROR_RE.test(v.trim());
    },
    ISERROR(val) { return typeof val === "string" && EXCEL_ERROR_RE.test(val.trim()); },
    ISNA(val) { return String(val ?? "").trim() === "#N/A"; },
    TYPE(val) {
        if (FORMULA_FUNCTIONS.ISERROR(val)) return 16;
        if (Array.isArray(val)) return 64;
        if (typeof val === "boolean") return 4;
        if (val !== "" && !isNaN(Number(val))) return 1;
        return 2;
    },
    N(val) {
        if (typeof val === "boolean") return val ? 1 : 0;
        const n = Number(val);
        return isNaN(n) ? 0 : n;
    },
    NA() { return "#N/A"; },
    PMT(rate, nper, pv, fv = 0, type = 0) {
        const r = Number(rate), n = Number(nper), p = Number(pv), f = Number(fv), t = Number(type);
        if (r === 0) return -(p + f) / n;
        const pvif = Math.pow(1 + r, n);
        return (-r * (p * pvif + f)) / ((1 + r * t) * (pvif - 1));
    },
    FV(rate, nper, pmt, pv = 0, type = 0) {
        const r = Number(rate), n = Number(nper), m = Number(pmt), p = Number(pv), t = Number(type);
        if (r === 0) return -(p + m * n);
        return -(p * Math.pow(1 + r, n) + m * (1 + r * t) * ((Math.pow(1 + r, n) - 1) / r));
    },
    PV(rate, nper, pmt, fv = 0, type = 0) {
        const r = Number(rate), n = Number(nper), m = Number(pmt), f = Number(fv), t = Number(type);
        if (r === 0) return -(f + m * n);
        return -(f + m * (1 + r * t) * ((Math.pow(1 + r, n) - 1) / r)) / Math.pow(1 + r, n);
    },
    NPV(rate, ...values) {
        const r = Number(rate);
        return flattenArray(values).map(Number).reduce((acc, v, i) => acc + v / Math.pow(1 + r, i + 1), 0);
    },
    IRR(values, guess = 0.1) {
        const flows = flattenArray(values)
            .filter(v => !isBlankVal(v) && typeof unwrapBlank(v) !== "boolean" && !isNaN(Number(unwrapBlank(v))))
            .map(v => Number(unwrapBlank(v)));
        if (!flows.some(v => v > 0) || !flows.some(v => v < 0)) return "#NUM!";
        let rate = Number(guess);
        if (!isFinite(rate) || rate <= -1) rate = 0.1;
        for (let iter = 0; iter < 100; iter++) {
            let npv = 0, dNpv = 0;
            for (let t = 0; t < flows.length; t++) {
                const denom = Math.pow(1 + rate, t);
                if (!isFinite(denom) || denom === 0) return "#NUM!";
                npv += flows[t] / denom;
                if (t > 0) dNpv -= (t * flows[t]) / Math.pow(1 + rate, t + 1);
            }
            if (Math.abs(npv) < 1e-7) return isFinite(rate) ? rate : "#NUM!";
            if (dNpv === 0 || !isFinite(dNpv)) return "#NUM!";
            rate -= npv / dNpv;
            if (!isFinite(rate) || rate <= -1) return "#NUM!";
        }
        return "#NUM!";
    },
    SORT(array, sortIndex = 1, sortOrder = 1) {
        if (!Array.isArray(array)) return array;
        const idx = Number(sortIndex) - 1;
        const dir = Number(sortOrder) >= 0 ? 1 : -1;
        return [...array].sort((a, b) => {
            const va = Array.isArray(a) ? a[idx] : a;
            const vb = Array.isArray(b) ? b[idx] : b;
            return va == vb ? 0 : (va > vb ? dir : -dir);
        });
    },
    SORTBY(array, byArray, sortOrder = 1) {
        if (!Array.isArray(array)) return array;
        const keys = flattenArray(byArray);
        const dir = Number(sortOrder) >= 0 ? 1 : -1;
        return array.map((row, i) => ({ row, key: keys[i] }))
            .sort((a, b) => a.key == b.key ? 0 : (a.key > b.key ? dir : -dir))
            .map(x => x.row);
    },
    TAKE(array, rows, cols = null) {
        if (!Array.isArray(array)) return array;
        const rSliced = Number(rows) >= 0 ? array.slice(0, Number(rows)) : array.slice(Number(rows));
        if (cols == null) return rSliced;
        return rSliced.map(r => Array.isArray(r) ? (Number(cols) >= 0 ? r.slice(0, Number(cols)) : r.slice(Number(cols))) : r);
    },
    DROP(array, rows, cols = null) {
        if (!Array.isArray(array)) return array;
        const rSliced = Number(rows) >= 0 ? array.slice(Number(rows)) : array.slice(0, array.length + Number(rows));
        if (cols == null) return rSliced;
        return rSliced.map(r => Array.isArray(r) ? (Number(cols) >= 0 ? r.slice(Number(cols)) : r.slice(0, r.length + Number(cols))) : r);
    },
    EXPAND(array, rows, cols, padWith = "") {
        const src = Array.isArray(array) ? array : [[array]];
        const out = [];
        for (let r = 0; r < Number(rows); r++) {
            const row = [];
            for (let c = 0; c < Number(cols); c++) {
                row.push(src[r]?.[c] ?? padWith);
            }
            out.push(row);
        }
        return out;
    },
    LET(...args) { return args[args.length - 1]; },
    LAMBDA(...args) { return args[args.length - 1]; },
    MAP(array, fn) { return typeof fn === "function" ? flattenArray(array).map(fn) : array; },
    REDUCE(init, array, fn) { return typeof fn === "function" ? flattenArray(array).reduce(fn, init) : init; },
    SCAN(init, array, fn) {
        if (typeof fn !== "function") return [init];
        let acc = init;
        return flattenArray(array).map(v => (acc = fn(acc, v)));
    },
    BYROW(array, fn) { return Array.isArray(array) && typeof fn === "function" ? array.map(fn) : array; },
    BYCOL(array, fn) {
        if (!Array.isArray(array) || !Array.isArray(array[0]) || typeof fn !== "function") return array;
        return array[0].map((_, c) => fn(array.map(r => r[c])));
    },
    MAKEARRAY(rows, cols, fn) {
        if (typeof fn !== "function") return "#VALUE!";
        const out = [];
        for (let r = 1; r <= Number(rows); r++) {
            const row = [];
            for (let c = 1; c <= Number(cols); c++) row.push(fn(r, c));
            out.push(row);
        }
        return out;
    },
    TEXT(value, formatText) {
        const val = unwrapBlank(value);
        const fmt = String(unwrapBlank(formatText) ?? "");
        const d = parseExcelDate(val);
        if (d && /[ymd]/i.test(fmt) && !/[#0]/.test(fmt)) {
            const daysJp = ["日", "月", "火", "水", "木", "金", "土"];
            return fmt
                .replace(/yyyy/gi, String(d.getFullYear()))
                .replace(/yy/gi, String(d.getFullYear()).slice(-2))
                .replace(/mm/gi, String(d.getMonth() + 1).padStart(2, "0"))
                .replace(/m/gi, String(d.getMonth() + 1))
                .replace(/dd/gi, String(d.getDate()).padStart(2, "0"))
                .replace(/d/gi, String(d.getDate()))
                .replace(/aaaa/g, `${daysJp[d.getDay()]}曜日`)
                .replace(/aaa/g, daysJp[d.getDay()]);
        }
        const num = Number(val);
        if (isNaN(num)) return String(val ?? "");
        if (fmt.includes("%")) {
            const dec = (fmt.split(".")[1] || "").replace(/[^0#]/g, "").length;
            return `${(num * 100).toFixed(dec)}%`;
        }
        const [intFmt, decFmt = ""] = fmt.split(".");
        const dec = decFmt.replace(/[^0#]/g, "").length;
        const minIntDigits = (intFmt.match(/0/g) || []).length;
        if (fmt.includes(",")) {
            return num.toLocaleString("ja-JP", {
                minimumIntegerDigits: Math.max(1, minIntDigits),
                minimumFractionDigits: dec,
                maximumFractionDigits: dec
            });
        }
        if (minIntDigits > 1 && dec === 0) {
            const sign = num < 0 ? "-" : "";
            return sign + String(Math.abs(Math.round(num))).padStart(minIntDigits, "0");
        }
        return dec > 0 ? num.toFixed(dec) : String(Math.round(num));
    },
    VALUE(text) {
        const n = Number(String(unwrapBlank(text) ?? "").replace(/[¥￥,、\s]/g, ""));
        return isNaN(n) ? "#VALUE!" : n;
    },
    SEARCH(findText, withinText, startNum = 1) {
        const idx = String(unwrapBlank(withinText) ?? "").toLowerCase().indexOf(String(unwrapBlank(findText) ?? "").toLowerCase(), Math.max(0, Number(startNum) - 1));
        return idx === -1 ? "#VALUE!" : idx + 1;
    },
    EXACT(t1, t2) { return String(unwrapBlank(t1) ?? "") === String(unwrapBlank(t2) ?? ""); },
    PROPER(text) { return String(unwrapBlank(text) ?? "").replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase()); },
    REPT(text, count) {
        const cnt = Math.trunc(Number(unwrapBlank(count)));
        if (isNaN(cnt) || cnt < 0) return "#VALUE!";
        const str = String(unwrapBlank(text) ?? "");
        if (str.length * cnt > 32767) return "#VALUE!";
        return str.repeat(cnt);
    },
    CHAR(num) { return String.fromCharCode(Number(num)); },
    CODE(text) { return String(unwrapBlank(text) ?? "").charCodeAt(0) || "#VALUE!"; },
    TEXTBEFORE(text, delimiter, instanceNum = 1) {
        const s = String(unwrapBlank(text) ?? ""), d = String(unwrapBlank(delimiter) ?? "");
        const parts = s.split(d);
        const idx = Number(instanceNum);
        if (idx > 0 && idx < parts.length) return parts.slice(0, idx).join(d);
        return "#N/A";
    },
    TEXTAFTER(text, delimiter, instanceNum = 1) {
        const s = String(unwrapBlank(text) ?? ""), d = String(unwrapBlank(delimiter) ?? "");
        const parts = s.split(d);
        const idx = Number(instanceNum);
        if (idx > 0 && idx < parts.length) return parts.slice(idx).join(d);
        return "#N/A";
    },
    SUMPRODUCT(...arrays) {
        if (!arrays.length) return 0;
        const flats = [];
        for (const a of arrays) {
            const flat = flattenArray(a);
            const nums = [];
            for (const raw of flat) {
                const v = unwrapBlank(raw);
                if (typeof v === "string" && EXCEL_ERROR_RE.test(v.trim())) return v.trim();
                nums.push(typeof v === "number" && Number.isFinite(v) ? v : 0);
            }
            flats.push(nums);
        }
        const len = flats[0].length;
        if (flats.some(arr => arr.length !== len)) return "#VALUE!";
        let total = 0;
        for (let i = 0; i < len; i++) {
            let prod = 1;
            for (let j = 0; j < flats.length; j++) prod *= flats[j][i];
            total += prod;
        }
        return total;
    },
    CEILING(num, sig = 1) {
        const n = Number(num), s = Number(sig);
        if (s === 0) return 0;
        return Math.ceil(n / s) * s;
    },
    FLOOR(num, sig = 1) {
        const n = Number(num), s = Number(sig);
        if (s === 0) return "#DIV/0!";
        return Math.floor(n / s) * s;
    },
    MROUND(num, mult) {
        const n = Number(num), m = Number(mult);
        if (m === 0) return 0;
        return Math.round(n / m) * m;
    },
    TRUNC(num, digits = 0) {
        const factor = Math.pow(10, Math.trunc(Number(digits)));
        return Math.trunc(Number(num) * factor) / factor;
    },
    SIGN(num) { return Math.sign(Number(num)); },
    EVEN(num) { const n = Number(num); const ceil = Math.ceil(Math.abs(n)); const res = ceil % 2 === 0 ? ceil : ceil + 1; return n < 0 ? -res : res; },
    ODD(num) { const n = Number(num); const ceil = Math.ceil(Math.abs(n)); const res = ceil % 2 === 1 ? ceil : ceil + 1; return n < 0 ? -res : res; },
    FACT(num) { let r = 1; for (let i = 2; i <= Math.trunc(Number(num)); i++) r *= i; return r; },
    PI() { return Math.PI; },
    SIN(x) { return Math.sin(Number(x)); },
    COS(x) { return Math.cos(Number(x)); },
    TAN(x) { return Math.tan(Number(x)); },
    RADIANS(deg) { return Number(deg) * Math.PI / 180; },
    DEGREES(rad) { return Number(rad) * 180 / Math.PI; },
    LOG(num, base = 10) { return Math.log(Number(num)) / Math.log(Number(base)); },
    LOG10(num) { return Math.log10(Number(num)); },
    LN(num) { return Math.log(Number(num)); },
    EXP(num) { return Math.exp(Number(num)); },
    RAND() { return Math.random(); },
    RANDBETWEEN(bottom, top) { return Math.floor(Math.random() * (Number(top) - Number(bottom) + 1)) + Number(bottom); },
    LARGE(array, k) {
        const sorted = flattenArray(array).filter(v => !isBlankVal(v) && !isNaN(Number(v))).map(Number).sort((a, b) => b - a);
        return sorted[Number(k) - 1] ?? "#NUM!";
    },
    SMALL(array, k) {
        const sorted = flattenArray(array).filter(v => !isBlankVal(v) && !isNaN(Number(v))).map(Number).sort((a, b) => a - b);
        return sorted[Number(k) - 1] ?? "#NUM!";
    },
    RANK(num, ref, order = 0) {
        const target = Number(num);
        const sorted = flattenArray(ref).filter(v => !isBlankVal(v) && !isNaN(Number(v))).map(Number).sort((a, b) => Number(order) === 0 ? b - a : a - b);
        const idx = sorted.indexOf(target);
        return idx === -1 ? "#N/A" : idx + 1;
    },
    COUNTBLANK(range) {
        return flattenArray(range).filter(v => isBlankVal(v)).length;
    },
    CHOOSE(indexNum, ...values) {
        const idx = Math.trunc(Number(indexNum)) - 1;
        return values[idx] !== undefined ? values[idx] : "#VALUE!";
    },
    LOOKUP(lookupValue, lookupVector, resultVector = null) {
        const keys = flattenArray(lookupVector);
        const vals = resultVector ? flattenArray(resultVector) : keys;
        let idx = -1;
        keys.forEach((v, i) => { if (v <= lookupValue) idx = i; });
        return idx !== -1 ? vals[idx] : "#N/A";
    },
    TRANSPOSE(array) {
        if (!Array.isArray(array)) return [[array]];
        const matrix = Array.isArray(array[0]) ? array : [array];
        const rows = matrix.length, cols = Math.max(...matrix.map(r => r.length));
        return Array.from({ length: cols }, (_, c) => Array.from({ length: rows }, (__, r) => matrix[r][c] ?? ""));
    },
    HSTACK(...arrays) {
        const mats = arrays.map(a => Array.isArray(a) ? (Array.isArray(a[0]) ? a : a.map(v => [v])) : [[a]]);
        const maxR = Math.max(...mats.map(m => m.length));
        return Array.from({ length: maxR }, (_, r) => mats.flatMap(m => m[r] || Array(m[0]?.length || 1).fill("#N/A")));
    },
    VSTACK(...arrays) {
        return arrays.flatMap(a => Array.isArray(a) ? (Array.isArray(a[0]) ? a : [a]) : [[a]]);
    },
    ISERR(val) { return FORMULA_FUNCTIONS.ISERROR(val) && String(val ?? "").trim() !== "#N/A"; },
    ISEVEN(val) { return Math.trunc(Number(val)) % 2 === 0; },
    ISODD(val) { return Math.abs(Math.trunc(Number(val)) % 2) === 1; },
    HYPERLINK(linkLocation, friendlyName = null) {
        const url = String(unwrapBlank(linkLocation) ?? "").trim();
        if (!url) return "#VALUE!";
        const label = friendlyName != null && !isBlankVal(friendlyName)
            ? String(unwrapBlank(friendlyName))
            : url;
        return label;
    },
    IFNA(value, valueIfNa = "") {
        const raw = unwrapBlank(value);
        return String(raw ?? "").trim() === "#N/A" ? valueIfNa : value;
    },
    STDEV_S(...args) {
        return FORMULA_FUNCTIONS.STDEV(...args);
    },
    RANK_EQ(num, ref, order = 0) {
        return FORMULA_FUNCTIONS.RANK(num, ref, order);
    }
};

export const FORMULA_FN_NAMES = Object.keys(FORMULA_FUNCTIONS);
export const FORMULA_FN_VALUES = Object.values(FORMULA_FUNCTIONS);