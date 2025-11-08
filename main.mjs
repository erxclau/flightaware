import { csvFormat, tsvParse } from "d3-dsv";
import { JSDOM } from "jsdom";
import { readFileSync, writeFileSync } from "node:fs";

const airports = tsvParse(readFileSync("./airports.tsv").toString());

const weekday = {
  "https://www.flightaware.com/live/cancelled/minus3days/": -3,
  "https://www.flightaware.com/live/cancelled/minus2days/": -2,
  "https://www.flightaware.com/live/cancelled/yesterday/": -1,
  "https://www.flightaware.com/live/cancelled/today/": 0,
};

const sleep = async (ms) => {
  return new Promise((res) => setTimeout(res, ms));
};

const rows = [];

for await (const airport of [{ icao: "", name: "All" }, ...airports]) {
  const urlBases = [
    "https://www.flightaware.com/live/cancelled/minus3days/", // TODO: unclear if Monday totals are accurate. they seem to decrease over time, perhaps due to time zones.
    "https://www.flightaware.com/live/cancelled/minus2days/",
    "https://www.flightaware.com/live/cancelled/yesterday/",
    "https://www.flightaware.com/live/cancelled/today/",
  ];

  for await (const urlBase of urlBases) {
    const url = new URL(airport.icao, urlBase);

    const response = await fetch(url);
    if (!response.ok) {
      console.error(`${response.status}: ${response.statusText}`);
      continue;
    }

    const html = await response.text();
    const dom = new JSDOM(html);

    const [
      _,
      totalDelays,
      totalUsDelays,
      totalCancellations,
      totalUsCancellations,
    ] = Array.from(dom.window.document.querySelectorAll("h3")).map((d) => {
      const content = d.textContent;
      return +content
        .substring(content.lastIndexOf(":") + 1)
        .trim()
        .replaceAll(",", "");
    });

    const row = {
      ...airport,
      day: weekday[urlBase],
      totalDelays,
      totalUsDelays,
      totalCancellations,
      totalUsCancellations,
    };

    console.log(row);

    rows.push(row);

    await sleep(250);
  }
}

writeFileSync(
  new Date(
    Date.parse(
      new Date().toLocaleString("en-US", { timeZone: "America/New_York" })
    )
  )
    .toISOString()
    .substring(0, 10) + ".csv",
  csvFormat(rows)
);
