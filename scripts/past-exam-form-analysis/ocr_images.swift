// Local OCR for comparing forms. Does not modify the source images or application.
import AppKit
import Foundation
import Vision

struct Line: Codable {
    let text: String
    let confidence: Float
    let x: Double
    let y: Double
    let height: Double
}
let args = CommandLine.arguments
guard args.count == 3 else { fatalError("Usage: ocr-images MANIFEST OUTPUT_DIR") }
let paths = try JSONDecoder().decode([String].self, from: Data(contentsOf: URL(fileURLWithPath: args[1])))
let output = URL(fileURLWithPath: args[2], isDirectory: true)
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
let encoder = JSONEncoder()
encoder.outputFormatting = [.sortedKeys]
for (index, path) in paths.enumerated() {
    let url = URL(fileURLWithPath: path)
    let target = output.appendingPathComponent(url.deletingPathExtension().lastPathComponent + ".json")
    if FileManager.default.fileExists(atPath: target.path) { continue }
    try autoreleasepool {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.recognitionLanguages = ["ko-KR", "en-US"]
        request.usesLanguageCorrection = false
        request.usesCPUOnly = true
        try VNImageRequestHandler(url: url).perform([request])
        var lines: [Line] = []
        for observation in request.results ?? [] {
            guard let candidate = observation.topCandidates(1).first else { continue }
            let b = observation.boundingBox
            lines.append(Line(text: candidate.string, confidence: candidate.confidence,
                              x: b.minX, y: 1 - b.maxY, height: b.height))
        }
        lines.sort { a, b in abs(a.y - b.y) < 0.003 ? a.x < b.x : a.y < b.y }
        try encoder.encode(lines).write(to: target, options: .atomic)
        print("OCR \(index + 1)/\(paths.count) \(url.lastPathComponent) \(lines.count)")
        fflush(stdout)
    }
}
