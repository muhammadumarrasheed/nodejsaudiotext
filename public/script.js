async function convertToText() {
    const fileInput = document.getElementById("oggFile");
    const transcriptContainer = document.getElementById("transcriptContainer");

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    const response = await fetch('/convert', { method: 'POST', body: formData });
    const data = await response.json();

    if (data.error) {
        transcriptContainer.textContent = `Error: ${data.error}`;
    } else {
        transcriptContainer.textContent = data.transcript;
    }
}
