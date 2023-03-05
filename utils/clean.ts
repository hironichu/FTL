//in the ./dist, remove all file that isnt stryctly ending with .so or .dll or .dylib
if (import.meta.main) {
  try {
    Deno.statSync("./dist");
    const rule = /^(.*)\.so$|^(.*)\.dll$|^(.*)\.dylib$/;
    const files = Deno.readDirSync("./dist");
    for (const file of files) {
      if (!rule.test(file.name)) {
        Deno.removeSync("./dist/" + file.name);
      }
    }
    console.info(`Cleaned up ./dist`);
  } catch {
    console.info(`Count not find ./dist`);
  }
}