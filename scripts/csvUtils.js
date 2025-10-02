import * as common from "./common.js";

export const CSV_HEADER = `"Name","Edition","Collector Number","Count"`;

export const formatYYYYMMDD = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}${month}${day}`;
};

export const getCsvLine = (card) =>
    `"${card.name}",${card.set},${card.oracle?.collector_number ?? 0},${card.owned}`;

export const csvRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;

export const csvMap = (arr) =>
    arr
        .split(/\n/g)
        .map((row) => row.split(csvRegex))
        .reduce((acc, [name, edition, count]) => {
            acc[`${name},${edition}`] = count;
            return acc;
        }, {});

export function getDiff(lastCsv, newCsv) {
    const lastArr = csvMap(lastCsv);
    const newArr = csvMap(newCsv);
    const diff = [];
    Object.entries(newArr).forEach(([key, value]) => {
        const lastValue = lastArr[key];
        if (lastValue !== undefined) {
            if (lastValue != value) {
                diff.push(`${key},${value - lastValue}`);
            }
        } else {
            diff.push(`${key},${value}`);
        }
    });
    console.log(`[${diff.length}] rows diff`);
    return diff.join("\n");
}

export function generateCsvContent(cards) {
    console.time("creating csv");
    let csvContent = CSV_HEADER;
    cards.forEach((card) => {
        csvContent += "\n" + getCsvLine(card);
    });
    console.timeEnd("creating csv");
    return csvContent;
}

export function generateDiffCsv(lastCsvContent, newCsvContent) {
    const diff = CSV_HEADER + "\n" + getDiff(lastCsvContent, newCsvContent);
    return diff;
}

export function writeCsvFiles(cards) {
    const newCsvContent = generateCsvContent(cards);
    const today = formatYYYYMMDD(new Date());

    const result = {
        csvPath: `csvToImport_${today}.csv`,
    };

    try {
        // Get the last CSV file for diff comparison
        const lastCsv = common.loadFile("csvToImport_", "csv");
        console.log(`Creating diff from [${lastCsv}]`);
        const lastCsvContent = common.read(lastCsv).toString();

        // Generate diff and check if there are actual differences
        const diffContent = getDiff(lastCsvContent, newCsvContent);

        // Only write diff if there are actual changes
        if (diffContent.trim()) {
            const diff = CSV_HEADER + "\n" + diffContent;
            console.time("writing diff");
            common.writeToData(diff, `diff_${today}.csv`);
            console.timeEnd("writing diff");
            result.diffPath = `diff_${today}.csv`;
        } else {
            console.log("No differences found, skipping diff file creation");
        }
    } catch (error) {
        console.warn("Could not load previous CSV file for diff comparison:", error.message);
        console.log("Skipping diff file creation");
    }

    // Write new CSV
    console.time("writing csv");
    common.writeToData(newCsvContent, `csvToImport_${today}.csv`);
    console.timeEnd("writing csv");

    return result;
}
