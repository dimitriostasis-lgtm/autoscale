import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

type ResolverTree = Record<string, Record<string, unknown>>;

const directory = path.dirname(fileURLToPath(import.meta.url));

function mergeResolvers(target: ResolverTree, source: ResolverTree): ResolverTree {
  for (const [key, value] of Object.entries(source)) {
    target[key] = {
      ...(target[key] || {}),
      ...value,
    };
  }
  return target;
}

export async function loadResolvers(): Promise<ResolverTree> {
  const files = (await fs.readdir(directory))
    .filter((fileName) => fileName.endsWith(".resolver.ts") || fileName.endsWith(".resolver.js"))
    .sort();

  let merged: ResolverTree = {};

  for (const fileName of files) {
    const moduleUrl = pathToFileURL(path.join(directory, fileName)).href;
    const moduleExports = await import(moduleUrl);
    for (const exportedValue of Object.values(moduleExports)) {
      if (exportedValue && typeof exportedValue === "object") {
        merged = mergeResolvers(merged, exportedValue as ResolverTree);
      }
    }
  }

  return merged;
}