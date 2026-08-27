import { readFile, writeFile } from "node:fs/promises";

const inputPath = "src/assets/sounds/Objects, Writing, Pencil On Paper, Stroke.wav";
const outputPath = "src/assets/sounds/Pencil On Paper, Stroke Normalized.wav";
const loopStart = 0.37;
const loopEnd = 0.53;
const windowSeconds = 0.005;

const source = await readFile(inputPath);
const channels = source.readUInt16LE(22);
const sampleRate = source.readUInt32LE(24);
const bitsPerSample = source.readUInt16LE(34);
const bytesPerSample = bitsPerSample / 8;
const frameSize = channels * bytesPerSample;
let offset = 12;
let dataOffset = -1;
let dataSize = 0;

while (offset + 8 <= source.length) {
  const chunkId = source.toString("ascii", offset, offset + 4);
  const chunkSize = source.readUInt32LE(offset + 4);
  if (chunkId === "data") {
    dataOffset = offset + 8;
    dataSize = chunkSize;
    break;
  }
  offset += 8 + chunkSize + (chunkSize & 1);
}

if (bitsPerSample !== 16 || dataOffset < 0) {
  throw new Error("Expected a 16-bit PCM WAV with a data chunk.");
}

const frameCount = Math.floor(dataSize / frameSize);
const loopStartFrame = Math.floor(frameCount * loopStart);
const loopEndFrame = Math.floor(frameCount * loopEnd);
const windowFrames = Math.max(1, Math.floor(sampleRate * windowSeconds));
const rmsValues = [];

for (let start = loopStartFrame; start < loopEndFrame; start += windowFrames) {
  const end = Math.min(loopEndFrame, start + windowFrames);
  let sumSquares = 0;
  let count = 0;
  for (let frame = start; frame < end; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = source.readInt16LE(dataOffset + frame * frameSize + channel * 2) / 32768;
      sumSquares += sample * sample;
      count += 1;
    }
  }
  rmsValues.push(Math.sqrt(sumSquares / Math.max(1, count)));
}

const targetRms = rmsValues.reduce((sum, value) => sum + value, 0) / rmsValues.length;
const gains = rmsValues.map((value) => Math.min(1.5, Math.max(0.7, targetRms / Math.max(value, 0.0001))));
const output = Buffer.from(source);

for (let frame = loopStartFrame; frame < loopEndFrame; frame += 1) {
  const position = (frame - loopStartFrame) / Math.max(1, loopEndFrame - loopStartFrame);
  const windowPosition = position * (gains.length - 1);
  const lower = Math.floor(windowPosition);
  const upper = Math.min(gains.length - 1, lower + 1);
  const fraction = windowPosition - lower;
  const gain = gains[lower] + (gains[upper] - gains[lower]) * fraction;

  for (let channel = 0; channel < channels; channel += 1) {
    const sampleOffset = dataOffset + frame * frameSize + channel * 2;
    const sample = output.readInt16LE(sampleOffset);
    output.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(sample * gain))), sampleOffset);
  }
}

await writeFile(outputPath, output);
console.log(`Wrote ${outputPath} with target RMS ${targetRms.toFixed(6)}`);