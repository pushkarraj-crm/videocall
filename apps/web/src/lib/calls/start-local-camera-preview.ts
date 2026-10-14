export async function startLocalCameraPreview(
  container: HTMLElement,
): Promise<{ stream: MediaStream; cleanup: () => void }> {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  const video = document.createElement('video');
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.className = 'h-full w-full object-cover';
  video.srcObject = stream;
  container.replaceChildren(video);
  void video.play().catch(() => {});

  return {
    stream,
    cleanup: () => {
      stream.getTracks().forEach((track) => track.stop());
      container.replaceChildren();
    },
  };
}