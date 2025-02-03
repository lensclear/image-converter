document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('imageUpload');
    const dropArea = document.getElementById('dropArea');
    const previewArea = document.getElementById('previewArea');
    const thumbnailArea = document.getElementById('thumbnailArea');
    const convertButton = document.getElementById('convertButton');
    const downloadLinkArea = document.getElementById('downloadLinkArea');
    const downloadLink = document.getElementById('downloadLink');
    const compressionInfo = document.getElementById('compressionInfo');
    const removeAllImagesButton = document.getElementById('removeAllImagesButton');
    const noFileSelectedText = document.getElementById('noFileSelectedText');
    const qualitySlider = document.getElementById('qualitySlider');
    const qualityValueDisplay = document.getElementById('qualityValue');
    const originalPreviewImage = document.getElementById('originalPreviewImage');
    const webpPreviewImage = document.getElementById('webpPreviewImage');

    let uploadedFiles = [];
    let currentQuality = 75;

    // Verify required libraries
    const imageCompression = window.imageCompression;
    const JSZip = window.JSZip;

    if (!imageCompression || !JSZip) {
        console.error('Required libraries not loaded');
        alert('Required libraries failed to load. Please check your internet connection.');
        return;
    }

    // Event Listeners
    fileInput.addEventListener('change', handleFile);
    dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropArea.classList.add('border-blue-500', 'bg-gray-50');
    });
    dropArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropArea.classList.remove('border-blue-500', 'bg-gray-50');
    });
    dropArea.addEventListener('drop', dropHandler);
    qualitySlider.addEventListener('input', handleQualityChange);

    function dropHandler(e) {
        e.preventDefault();
        dropArea.classList.remove('border-blue-500', 'bg-gray-50');
        const files = Array.from(e.dataTransfer.files);
        handleFilesSelection(files);
    }

    function handleFile(event) {
        const files = Array.from(event.target.files);
        handleFilesSelection(files);
    }

    async function handleFilesSelection(files) {
        if (!files || files.length === 0) {
            resetUI();
            noFileSelectedText.classList.remove('hidden');
            return;
        }

        // Filter valid image files
        const validFiles = files.filter(file => 
            file.type.startsWith('image/png') || 
            file.type.startsWith('image/jpeg')
        );

        if (validFiles.length === 0) {
            alert('Please select only PNG or JPG images.');
            resetUI();
            return;
        }

        uploadedFiles = validFiles; // Remove the 20 file limit
        
        // Show UI elements
        previewArea.classList.remove('hidden');
        convertButton.classList.remove('hidden');
        convertButton.disabled = false;
        noFileSelectedText.classList.add('hidden');
        removeAllImagesButton.hidden = false;
        dropArea.classList.add('has-files');

        // Clear existing thumbnails
        thumbnailArea.innerHTML = '';

        // Create thumbnails and set preview
        for (let i = 0; i < uploadedFiles.length; i++) {
            const file = uploadedFiles[i];
            createThumbnail(file, i);

            // Set the first image as preview
            if (i === 0) {
                setPreviewImage(file);
            }
        }
    }

    function createThumbnail(file, index) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const thumbnailContainer = document.createElement('div');
            thumbnailContainer.className = 'thumbnail-container';

            const img = document.createElement('img');
            img.src = e.target.result;
            img.alt = file.name;
            img.className = 'thumbnail-image';

            const removeButton = document.createElement('button');
            removeButton.innerHTML = '×';
            removeButton.className = 'thumbnail-remove-button';
            removeButton.onclick = () => removeThumbnail(index);

            thumbnailContainer.appendChild(img);
            thumbnailContainer.appendChild(removeButton);
            thumbnailArea.appendChild(thumbnailContainer);
        };
        reader.readAsDataURL(file);
    }

    async function setPreviewImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            originalPreviewImage.src = e.target.result;
            previewFirstImageWithQuality(file, currentQuality);
        };
        reader.readAsDataURL(file);
    }

    async function previewFirstImageWithQuality(file, quality) {
        if (!file) return;

        try {
            const options = {
                maxSizeMB: 2,
                maxWidthOrHeight: 2000,
                useWebWorker: true,
                fileType: 'webp',
                quality: quality / 100
            };

            const compressedFile = await imageCompression(file, options);
            const reader = new FileReader();
            
            reader.onload = (e) => {
                webpPreviewImage.src = e.target.result;
                
                const originalSize = (file.size / 1024).toFixed(2);
                const compressedSize = (compressedFile.size / 1024).toFixed(2);
                const savings = (100 * (1 - compressedFile.size / file.size)).toFixed(1);
                
                compressionInfo.textContent = 
                    `Compression: ${savings}% reduction ` +
                    `(${originalSize}KB → ${compressedSize}KB)`;
                compressionInfo.classList.remove('hidden');
            };
            
            reader.readAsDataURL(compressedFile);

        } catch (error) {
            console.error('Preview generation failed:', error);
            alert('Failed to generate preview. Please try again.');
        }
    }

    function handleQualityChange(event) {
        currentQuality = parseInt(event.target.value);
        qualityValueDisplay.textContent = currentQuality;
        
        if (uploadedFiles.length > 0) {
            previewFirstImageWithQuality(uploadedFiles[0], currentQuality);
        }
    }

    function removeThumbnail(index) {
        uploadedFiles.splice(index, 1);
        thumbnailArea.innerHTML = '';
        
        if (uploadedFiles.length > 0) {
            uploadedFiles.forEach((file, i) => createThumbnail(file, i));
            setPreviewImage(uploadedFiles[0]);
        } else {
            resetUI();
        }
    }

    convertButton.onclick = async () => {
        if (uploadedFiles.length === 0) {
            alert('Please select images first.');
            return;
        }

        convertButton.disabled = true;
        convertButton.textContent = 'Converting...';
        
        try {
            const zip = new JSZip();
            let totalOriginalSize = 0;
            let totalCompressedSize = 0;

            for (const file of uploadedFiles) {
                const compressedFile = await imageCompression(file, {
                    maxSizeMB: 2,
                    maxWidthOrHeight: 2000,
                    useWebWorker: true,
                    fileType: 'webp',
                    quality: currentQuality / 100
                });

                totalOriginalSize += file.size;
                totalCompressedSize += compressedFile.size;

                // Add to zip with .webp extension
                const newFileName = file.name.replace(/\.(png|jpg|jpeg)$/i, '.webp');
                zip.file(newFileName, compressedFile);
            }

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const zipUrl = URL.createObjectURL(zipBlob);
            
            downloadLink.href = zipUrl;
            downloadLinkArea.classList.remove('hidden');

            const savings = (100 * (1 - totalCompressedSize / totalOriginalSize)).toFixed(1);
            compressionInfo.textContent = 
                `Total compression: ${savings}% reduction ` +
                `(${(totalOriginalSize / 1024).toFixed(2)}KB → ${(totalCompressedSize / 1024).toFixed(2)}KB)`;
            
        } catch (error) {
            console.error('Conversion failed:', error);
            alert('Failed to convert images. Please try again.');
        } finally {
            convertButton.disabled = false;
            convertButton.textContent = 'Convert Images';
        }
    };

    function resetUI() {
        uploadedFiles = [];
        thumbnailArea.innerHTML = '';
        previewArea.classList.add('hidden');
        convertButton.classList.add('hidden');
        downloadLinkArea.classList.add('hidden');
        compressionInfo.classList.add('hidden');
        removeAllImagesButton.hidden = true;
        fileInput.value = '';
        originalPreviewImage.src = '#';
        webpPreviewImage.src = '#';
    }

    removeAllImagesButton.onclick = () => {
        resetUI();
        noFileSelectedText.classList.remove('hidden');
    };
});
