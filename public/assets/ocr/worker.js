/* Keep CDN startup failures inside the OCR job so cancellation has no global error. */
try {
  self.importScripts(
    'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/worker.min.js',
  );
} catch {
  self.onmessage = (event) => {
    const { workerId, jobId, action } = event.data;
    self.postMessage({
      workerId,
      jobId,
      action,
      status: 'reject',
      data: 'OCR-Programm konnte nicht geladen werden.',
    });
    self.close();
  };
}
