const SORT_STRING = (s1, s2) => s1.localeCompare(s2);
const SORT_BY_VALUE = (o1, o2, k) => SORT_STRING(o1[k], o2[k]);

export const mapBy = (arr, id) =>
    arr.reduce((a, c) => {
        a[c[id]] = c;
        return a;
    }, {});

export const strip = (s) => normalize(s)?.split("/")[0]?.trim().replace(/\W+/g, "_").toLowerCase();
export const normalize = (s) => s?.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
