import fs from "node:fs/promises";
import path from "node:path";

/** A JSON file's contents, or undefined if there's no such file. */
export async function readJsonFile(file: string): Promise<unknown> {
  const contents = await fs.readFile(file, "utf8").catch(() => undefined);
  return contents === undefined ? undefined : JSON.parse(contents);
}

/** Writes the file whole or not at all, so a crash mid-write can't leave half of it. */
export async function writeFileAtomically(file: string, contents: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temporary, contents);
  await fs.rename(temporary, file);
}

/** Writes JSON files one at a time, in order, carrying on after a failed one. */
export class JsonFileWriter {
  readonly #file: string;
  #writing: Promise<void> = Promise.resolve();

  constructor(file: string) {
    this.#file = file;
  }

  write(value: unknown): Promise<void> {
    const contents = `${JSON.stringify(value, null, 2)}\n`;
    const write = () => writeFileAtomically(this.#file, contents);
    this.#writing = this.#writing.then(write, write);
    return this.#writing;
  }
}
