import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));

export async function loadTypeDefs(): Promise<string> {
  const files = (await fs.readdir(directory))
    .filter((fileName) => fileName.endsWith(".schema.graphql"))
    .sort();

  const contents = await Promise.all(files.map((fileName) => fs.readFile(path.join(directory, fileName), "utf8")));

  return contents.join("\n");
}