import "https://deno.land/std@0.158.0/dotenv/load.ts";

if (!Deno.env.get("DENO_AUTH_TOKENS")) {
  throw new Error("Please set DENO_AUTH_TOKENS to your auth tokens");
}
const data = await fetch(
  "https://api.github.com/repos/hironichu/FTL/releases",
  {
    headers: {
      Authorization: `token ${Deno.env.get("DENO_AUTH_TOKENS")!.split("@")[0]}`,
      Accept: "application/vnd.github.v3+json",
    },
  },
);
const json = await data.json();
let GitDLUrL: URL;
switch (Deno.build.os) {
  case "windows":
    GitDLUrL = new URL(json[0].assets.filter((item: { name: string}) => item.name.endsWith(".dll"))[0].url);
    break;
    case "linux": {
      let filename = "libftl";
      if (Deno.build.arch === "aarch64") {
        filename = "libftl_aarch64.so";
      } else { 
        filename = "libftl.so";
      }
      GitDLUrL = new URL(json[0].assets.filter((item: { name: string}) => item.name === filename)[0].url);
    }
    break;
  case "darwin":
    GitDLUrL = new URL(json[0].assets.filter((item: { name: string}) => item.name.endsWith(".dylib"))[0].url);
    break;
}
GitDLUrL.username = Deno.env.get("DENO_AUTH_TOKENS")!.split("@")[0]!;
export default GitDLUrL;