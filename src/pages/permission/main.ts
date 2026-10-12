// One-time camera grant page, opened in a normal tab when the Side Panel cannot show the
// permission prompt (ADR-001, [To verify]). Permission is stored per extension origin.
const button = document.querySelector<HTMLButtonElement>('#grant');
const statusEl = document.querySelector<HTMLParagraphElement>('#status');

button?.addEventListener('click', async () => {
  if (!statusEl) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    // Only the permission is needed here; release the camera immediately.
    stream.getTracks().forEach((t) => t.stop());
    statusEl.textContent = 'Camera access granted. You can close this tab and press Start Control.';
  } catch (e) {
    const name = e instanceof DOMException ? e.name : 'Error';
    statusEl.textContent =
      name === 'NotAllowedError'
        ? 'Camera access was blocked. Allow it from the camera icon in the address bar, then try again.'
        : `The camera could not be started (${name}).`;
  }
});
