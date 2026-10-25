export const strip = (s) => normalize(s)?.split("/")[0]?.trim().replace(/\W+/g, "_").toLowerCase();
export const normalize = (s) => s?.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
