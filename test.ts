import "https://deno.land/std@0.158.0/dotenv/load.ts";

const data = await fetch(
  "https://api.github.com/repos/hironichu/FTL/releases",
  {
    headers: {
      Authorization: `token ${Deno.env.get("DENO_AUTH_TOKENS")}`,
      Accept: "application/vnd.github.v3+json",
    },
  },
);
const json = await data.json();

const assetData = json[0].assets.filter((item: { name: string}) => item.name.endsWith(".dylib"))[0];
const assetURL = new URL(assetData.url)
assetURL.username = Deno.env.get("DENO_AUTH_TOKENS")!;
assetURL.password = "";
const req = new Request(assetURL.href);
const download = await fetch(req, {
  headers: {
    Accept: "application/octet-stream",
  },
});
console.log(download.url)