const FACE_MODELS_URL = "https://justadudewhohacks.github.io/face-api.js/models/";

const dropArea = document.getElementById("drop-area");
const loadingArea = document.getElementById("loading-area");
const strengthSlider = document.getElementById("strength-slider");
const strengthSliderValue = document.getElementById("strength-slider-value");
const clearImagesBtn = document.getElementById("clear-images");

// Create results container
const resultsContainer = document.createElement('div');
resultsContainer.id = 'results-container';
resultsContainer.style.padding = '20px';
resultsContainer.style.display = 'flex';
resultsContainer.style.flexDirection = 'column';
resultsContainer.style.gap = '20px';
document.body.appendChild(resultsContainer);

// loading overlay thing.
function showLoading(element) {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    spinner.textContent = '🤔';
    overlay.appendChild(spinner); // DEAR GOD HE'S SPINNING
    element.style.position = 'relative';
	element.style.borderRadius = '0.5rem';
	element.style.padding = '1.5rem';
    element.appendChild(overlay);
    return overlay;
}

// go away loading thing we're done here
function hideLoading(overlay) {
    if (overlay && overlay.parentElement) {
        overlay.parentElement.style.position = '';
        overlay.remove();
    }
}

dropArea.addEventListener("dragenter", highlight, false);
dropArea.addEventListener("dragover", highlight, false);
dropArea.addEventListener("dragleave", unhighlight, false);
dropArea.addEventListener("drop", handleDrop, false);
document.addEventListener("paste", handlePaste, false);

const audioCtx = new AudioContext();

function highlight(e) {
	e.preventDefault();
	dropArea.classList.add("highlight");
}

function unhighlight(e) {
	if (e) {
		e.preventDefault();
	}

	dropArea.classList.remove("highlight");
}

function handleDrop(e) {
	e.preventDefault();
	const dt = e.dataTransfer;
	const files = dt.files;

	handleFiles(files);
}

async function handleFiles(files) {
	for (let i = 0; i < files.length; i++) {
		const file = files[i];
		const card = document.createElement('div');
		card.className = 'result-card doneCanvas';
		resultsContainer.insertBefore(card, resultsContainer.firstChild);
		const loadingOverlay = showLoading(card);

		if (file.type.startsWith("image/")) {
			const img = document.createElement("img");
			img.file = file;

			const reader = new FileReader();
			reader.onload = async function(e) {
				img.src = e.target.result;
				await distortImage(img, card);
				hideLoading(loadingOverlay);
			};
			reader.readAsDataURL(file);
		} else if (file.type.startsWith("video/")) {
			await distortVideo(URL.createObjectURL(file));
			hideLoading(loadingOverlay);
		}
	}

	unhighlight();
}

function handlePaste(event) {
	if (!event.clipboardData.items) {
		return;
	}

	for (const item of event.clipboardData.items) {
		if (item.kind === "file") {
			const card = document.createElement('div');
			card.className = 'result-card doneCanvas';
			resultsContainer.insertBefore(card, resultsContainer.firstChild);
			const loadingOverlay = showLoading(card);

			if (item.type.startsWith("image/")) {
				const file = item.getAsFile();
				const img = document.createElement("img");
				img.src = URL.createObjectURL(file);

				img.onload = async () => {
					await distortImage(img, card);
					hideLoading(loadingOverlay);
				};
			} else if (item.type.startsWith("video/")) {
				const file = item.getAsFile();
				distortVideo(URL.createObjectURL(file)).then(() => {
					hideLoading(loadingOverlay);
				});
			}
		}
	}
}

async function initialLoad() {
	await faceapi.loadSsdMobilenetv1Model(FACE_MODELS_URL);

	loadingArea.style.display = "none";
	dropArea.style.display = "inherit";
}

strengthSlider.oninput = () => {
	strengthSliderValue.textContent = strengthSlider.value;
};

clearImagesBtn.onclick = () => {
	resultsContainer.innerHTML = '';
};

initialLoad();


// Bulge Handling
// 14/01/2025: dIABOLICAL WORDING - Wider

async function distortImage(img, existingCard = null) {
	const faces = await faceapi.detectAllFaces(img);
	console.log(faces);

	const canvas = fx.canvas();
	const texture = canvas.texture(img);
	canvas.draw(texture);
	await distortCanvas(faces, canvas);

	const card = existingCard || document.createElement('div');
	if (!existingCard) {
		card.className = 'result-card doneCanvas';
	}
	
	const bulgedImage = document.createElement('img');
	bulgedImage.src = canvas.toDataURL('image/png');
	bulgedImage.className = 'result-image';
	
	const copyBtn = document.createElement('button');
	copyBtn.textContent = 'Copy to Clipboard';
	copyBtn.className = 'result-button';
	copyBtn.onclick = async () => {
		try {
			const response = await fetch(bulgedImage.src);
			const blob = await response.blob();
			await navigator.clipboard.write([
				new ClipboardItem({
					[blob.type]: blob
				})
			]);
			copyBtn.textContent = 'Copied!';
			setTimeout(() => {
				copyBtn.textContent = 'Copy to Clipboard';
			}, 2000);
		} catch (err) {
			console.error('Failed to copy:', err);
			alert('Please right-click the image and select "Copy image"');
		}
	};
	
	card.innerHTML = '';  // Clear any loading indicator
	card.appendChild(bulgedImage);
	card.appendChild(copyBtn);
	
	if (!existingCard) {
		resultsContainer.insertBefore(card, resultsContainer.firstChild);
	}
}

async function distortVideo(vidUrl) {
	await audioCtx.resume();

	const canvas = fx.canvas();
	let texture = null;

	const preCanvas = document.createElement("canvas");
	preCanvas.style.display = 'none';
	document.body.appendChild(preCanvas);
	const ctx = preCanvas.getContext("2d");

	let recorder;
	let recordedChunks = [];

	const auVideo = document.createElement("video");
	auVideo.style.display = 'none';
	auVideo.src = vidUrl;
	document.body.appendChild(auVideo);

	let mutex = false;

	try {
		await window.getVideoFrames({
			videoUrl: vidUrl,
			async onFrame(frame) {
				while (mutex) {
					await sleep(1);
				}
				mutex = true;

				ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);

				if (texture) {
					texture.loadContentsOf(preCanvas);
				} else {
					texture = canvas.texture(preCanvas);
				}

				canvas.draw(texture);
				const faces = await faceapi.detectAllFaces(preCanvas);
				await distortCanvas(faces, canvas);

				if (!recorder) {
					const auDest = audioCtx.createMediaStreamDestination();
					const auSource = audioCtx.createMediaElementSource(auVideo);
					auSource.connect(audioCtx.destination);
					auSource.connect(auDest);
					await auVideo.play();

					recorder = new MediaRecorder(new MediaStream([canvas.captureStream(30).getVideoTracks()[0], auDest.stream.getAudioTracks()[0]]), {
						mimeType: "video/webm"
					});
					recorder.start();

					recorder.ondataavailable = e => {
						recordedChunks.push(e.data);
					};
				}

				frame.close();
				mutex = false;
			},
			onConfig(config) {
				preCanvas.width = config.codedWidth;
				preCanvas.height = config.codedHeight;
			}
		});

		recorder.onstop = () => {
			// Clean up all temporary elements
			auVideo.pause();
			auVideo.remove();
			preCanvas.remove();
			canvas.remove();
			
			// Clean up any leftover fx.canvas elements
			document.querySelectorAll('canvas[style*="position: absolute"]').forEach(el => el.remove());
			
			const blob = new Blob(recordedChunks, {type: "video/webm"});
			const outputUrl = URL.createObjectURL(blob);

			const outputVideo = document.createElement("video");
			outputVideo.controls = true;
			outputVideo.src = outputUrl;
			outputVideo.className = 'result-video';

			const card = document.createElement("div");
			card.className = "result-card doneCanvas";

			const downloadBtn = document.createElement("a");
			downloadBtn.textContent = "Download video";
			downloadBtn.download = "video.webm";
			downloadBtn.href = outputUrl;
			downloadBtn.className = 'result-button';

			card.appendChild(outputVideo);
			card.appendChild(downloadBtn);
			resultsContainer.insertBefore(card, resultsContainer.firstChild);
		};
		recorder.stop();
	} catch (error) {
		// Clean up on error
		auVideo.remove();
		preCanvas.remove();
		canvas.remove();
		document.querySelectorAll('canvas[style*="position: absolute"]').forEach(el => el.remove());
		throw error;
	}
}

async function distortCanvas(faces, canvas) {
	const multiplier = parseFloat(strengthSlider.value);

	for (const face of faces) {
		if (face.score < 0.667) {
			continue;
		}

		const centerX = face.box.x + (face.box.width / 2);
		const centerY = face.box.y + (face.box.height / 2);

		let strength = 0.66;
		let maxRadius = Math.max(face.box.width, face.box.height) / 2;
		maxRadius *= multiplier;
		strength *= multiplier;

		canvas.bulgePinch(centerX, centerY, maxRadius, strength);
		// Apply second bulge on forehead
		canvas.bulgePinch(centerX, centerY - (maxRadius / 2), maxRadius * 0.25, strength * 0.25);
	}

	canvas.update();
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
