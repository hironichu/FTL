const data = await fetch(
  "https://api.github.com/repos/hironichu/FTL/releases",
  {
    headers: {
      Accept: "application/vnd.github.v3+json",
    },
  },
);
const json = await data.json();
let GitDLUrL: URL = new URL("");
switch (Deno.build.os) {
  case "windows":
    GitDLUrL = new URL(
      json[0].assets.filter((item: { name: string }) =>
        item.name.endsWith(".dll")
      )[0].url,
    );
    break;
  case "linux":
    {
      let filename = "libftl";
      if (Deno.build.arch === "aarch64") {
        filename = "libftl_aarch64.so";
      } else {
        filename = "libftl.so";
      }
      GitDLUrL = new URL(
        json[0].assets.filter((item: { name: string }) =>
          item.name === filename
        )[0].url,
      );
    }
    break;
  case "darwin":
    GitDLUrL = new URL(
      json[0].assets.filter((item: { name: string }) =>
        item.name.endsWith(".dylib")
      )[0].url,
    );
    break;
}
export default GitDLUrL;
