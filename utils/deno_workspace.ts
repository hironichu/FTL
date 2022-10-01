// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

import { path, ReleasesMdFile, Repo } from "./deps.ts";

export class DenoWorkspace {
  #repo: Repo;

  static get rootDirPath() {
    const currentDirPath = path.dirname(path.fromFileUrl(import.meta.url));
    return path.resolve(currentDirPath, "../../");
  }

  static async load(): Promise<DenoWorkspace> {
    return new DenoWorkspace(
      await Repo.load({
        name: "ftl",
        path: DenoWorkspace.rootDirPath,
      }),
    );
  }

  private constructor(repo: Repo) {
    this.#repo = repo;
  }

  get repo() {
    return this.#repo;
  }

  get crates() {
    return this.#repo.crates;
  }


  getReleasesMdFile() {
    return new ReleasesMdFile(
      path.join(DenoWorkspace.rootDirPath, "Releases.md"),
    );
  }
}