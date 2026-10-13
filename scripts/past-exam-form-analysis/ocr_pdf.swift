// Extract positioned OCR from PDFs without a usable text layer. Local only.
import AppKit
import Foundation
import PDFKit
import Vision
struct Line: Codable {
    let text: String
    let confidence: Float
    let x: Double
    let y: Double
    let height: Double
    let column: Int
}
struct Page: Codable { let page: Int; let lines: [Line] }
let args = CommandLine.arguments
guard args.count == 3 else { fatalError("Usage: ocr-pdf PDF OUTPUT_DIR") }
let source = URL(fileURLWithPath: args[1])
guard let document = PDFDocument(url: source) else { fatalError("Cannot open PDF") }
let output = URL(fileURLWithPath: args[2], isDirectory: true)
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
let encoder = JSONEncoder()
for index in 0..<document.pageCount {
    let target = output.appendingPathComponent(String(format: "page-%03d.json",index+1))
    if FileManager.default.fileExists(atPath: target.path) { continue }
    try autoreleasepool {
        let page = document.page(at: index)!
        let bounds = page.bounds(for: .mediaBox)
        let scale = 180.0 / 72.0
        let context = CGContext(data: nil, width: Int(ceil(bounds.width * scale)),
                                height: Int(ceil(bounds.height * scale)), bitsPerComponent: 8,
                                bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(),
                                bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
        context.setFillColor(CGColor(gray: 1, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: context.width, height: context.height))
        context.scaleBy(x: scale, y: scale)
        context.translateBy(x: -bounds.minX, y: -bounds.minY)
        page.draw(with: .mediaBox, to: context)
        let image = context.makeImage()!
        var lines: [Line] = []
        for column in [0,1] {
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = .accurate
            request.recognitionLanguages = ["ko-KR", "en-US"]
            request.usesLanguageCorrection = false
            request.usesCPUOnly = true
            request.regionOfInterest = CGRect(x: Double(column)*0.5, y: 0, width: 0.5, height: 1)
            try VNImageRequestHandler(cgImage: image).perform([request])
            for o in request.results ?? [] {
                guard let t=o.topCandidates(1).first else { continue }
                let b=o.boundingBox
                lines.append(Line(text:t.string,confidence:t.confidence,x:Double(column)*0.5+b.minX*0.5,
                                  y:1-b.maxY,height:b.height,column:column))
            }
        }
        try encoder.encode(Page(page:index+1,lines:lines)).write(to:target,options:.atomic)
        print("\(source.lastPathComponent) \(index+1)/\(document.pageCount)")
        fflush(stdout)
    }
}
