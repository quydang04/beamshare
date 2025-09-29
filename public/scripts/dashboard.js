(function () {
    const overlay = document.getElementById('file-dashboard-overlay');
    const openButton = document.getElementById('open-dashboard');
    if (!overlay || !openButton) {
        return;
    }

    const closeButton = document.getElementById('close-dashboard');
    const fileInput = document.getElementById('dashboard-file-input');
    const visibilitySelect = document.getElementById('dashboard-visibility');
    const uploadButton = document.getElementById('dashboard-upload-button');
    const statusLabel = document.getElementById('dashboard-status');
    const tableBody = document.getElementById('file-dashboard-tbody');

    const previewModal = document.getElementById('file-preview-modal');
    const previewContainer = document.getElementById('file-preview-container');
    const previewTitle = document.getElementById('file-preview-title');
    const closePreviewButton = document.getElementById('close-preview');
    const downloadButton = document.getElementById('download-preview');
    const shareButton = document.getElementById('share-preview');

    let cachedFiles = [];
    let previewMeta = null;

    const formatBytes = (bytes) => {
        if (!bytes && bytes !== 0) return '—';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const exponent = bytes > 0 ? Math.floor(Math.log(bytes) / Math.log(1024)) : 0;
        const value = bytes / Math.pow(1024, exponent);
        return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
    };

    const formatDateTime = (value) => {
        if (!value) return '—';
        try {
            const date = new Date(value);
            return new Intl.DateTimeFormat('vi-VN', {
                dateStyle: 'medium',
                timeStyle: 'short'
            }).format(date);
        } catch (error) {
            return value;
        }
    };

    const resetPreviewContent = () => {
        previewContainer.innerHTML = '';
    };

    const setStatus = (message) => {
        if (statusLabel) {
            statusLabel.textContent = message;
        }
    };

    const requestFiles = async () => {
        try {
            const response = await fetch('/api/files', {
                credentials: 'same-origin'
            });
            if (!response.ok) {
                throw new Error('failed to fetch files');
            }
            const payload = await response.json();
            return Array.isArray(payload.files) ? payload.files : [];
        } catch (error) {
            console.error('Unable to load files', error);
            setStatus('Không thể tải danh sách tệp. Vui lòng thử lại.');
            return [];
        }
    };

    const refreshTable = async () => {
        cachedFiles = await requestFiles();
        tableBody.innerHTML = '';

        if (!cachedFiles.length) {
            const emptyRow = document.createElement('tr');
            emptyRow.className = 'file-dashboard-empty';
            const cell = document.createElement('td');
            cell.colSpan = 6;
            cell.textContent = 'Chưa có tệp nào trong thư viện.';
            emptyRow.appendChild(cell);
            tableBody.appendChild(emptyRow);
            return;
        }

        cachedFiles.forEach((file) => {
            const row = document.createElement('tr');

            const nameCell = document.createElement('td');
            nameCell.textContent = file.originalName;
            row.appendChild(nameCell);

            const typeCell = document.createElement('td');
            typeCell.textContent = file.mimeType || 'Không xác định';
            row.appendChild(typeCell);

            const sizeCell = document.createElement('td');
            sizeCell.textContent = formatBytes(file.size);
            row.appendChild(sizeCell);

            const visibilityCell = document.createElement('td');
            visibilityCell.textContent = file.visibility === 'private' ? 'Riêng tư' : 'Công khai';
            row.appendChild(visibilityCell);

            const createdCell = document.createElement('td');
            createdCell.textContent = formatDateTime(file.createdAt);
            row.appendChild(createdCell);

            const actionsCell = document.createElement('td');
            actionsCell.className = 'file-dashboard-actions';

            const previewBtn = document.createElement('button');
            previewBtn.textContent = 'Xem trước';
            previewBtn.addEventListener('click', () => openPreview(file));

            const shareBtn = document.createElement('button');
            shareBtn.textContent = 'Chia sẻ';
            shareBtn.addEventListener('click', () => shareFile(file));

            const toggleBtn = document.createElement('button');
            toggleBtn.textContent = 'Đổi quyền';
            toggleBtn.addEventListener('click', () => toggleVisibility(file));

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Xóa';
            deleteBtn.classList.add('danger');
            deleteBtn.addEventListener('click', () => removeFile(file));

            actionsCell.append(previewBtn, shareBtn, toggleBtn, deleteBtn);
            row.appendChild(actionsCell);

            tableBody.appendChild(row);
        });
    };

    const openOverlay = async () => {
        overlay.removeAttribute('hidden');
        document.body.style.overflow = 'hidden';
        await refreshTable();
    };

    const closeOverlay = () => {
        overlay.setAttribute('hidden', '');
        document.body.style.overflow = '';
    };

    const openPreview = (file) => {
        previewMeta = file;
        previewModal.removeAttribute('hidden');
        previewTitle.textContent = file.originalName;
        resetPreviewContent();

        const mimeType = (file.mimeType || '').toLowerCase();
        if (mimeType.startsWith('image/')) {
            const image = document.createElement('img');
            image.src = file.streamUrl;
            image.alt = file.originalName;
            previewContainer.appendChild(image);
        } else if (mimeType === 'application/pdf') {
            const frame = document.createElement('iframe');
            frame.src = file.streamUrl;
            frame.title = file.originalName;
            frame.width = '100%';
            frame.height = '100%';
            frame.loading = 'lazy';
            previewContainer.appendChild(frame);
        } else if (mimeType.startsWith('video/')) {
            const video = document.createElement('video');
            video.controls = true;
            video.src = file.streamUrl;
            video.style.maxHeight = '70vh';
            previewContainer.appendChild(video);
        } else {
            const fallback = document.createElement('div');
            fallback.className = 'preview-fallback';
            fallback.innerHTML = 'Không có bản xem trước cho loại tệp này.<br>Vui lòng tải xuống để xem nội dung.';
            previewContainer.appendChild(fallback);
        }
    };

    const closePreview = () => {
        previewModal.setAttribute('hidden', '');
        previewMeta = null;
        resetPreviewContent();
    };

    const removeFile = async (file) => {
        if (!confirm(`Bạn có chắc muốn xóa "${file.originalName}"?`)) {
            return;
        }
        try {
            const response = await fetch(`/api/files/${file.id}`, {
                method: 'DELETE',
                credentials: 'same-origin'
            });
            if (!response.ok && response.status !== 204) {
                throw new Error('failed to delete');
            }
            await refreshTable();
            setStatus(`Đã xóa tệp "${file.originalName}".`);
        } catch (error) {
            console.error('Unable to delete file', error);
            setStatus('Không thể xóa tệp. Vui lòng thử lại.');
        }
    };

    const toggleVisibility = async (file) => {
        const nextVisibility = file.visibility === 'private' ? 'public' : 'private';
        try {
            const response = await fetch(`/api/files/${file.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({visibility: nextVisibility}),
                credentials: 'same-origin'
            });
            if (!response.ok) {
                throw new Error('failed to update visibility');
            }
            setStatus(`Đã chuyển "${file.originalName}" sang chế độ ${nextVisibility === 'private' ? 'riêng tư' : 'công khai'}.`);
            await refreshTable();
        } catch (error) {
            console.error('Unable to change visibility', error);
            setStatus('Không thể cập nhật quyền truy cập.');
        }
    };

    const shareFile = async (file) => {
        if (!window.Events || typeof window.Events.fire !== 'function') {
            setStatus('Không thể chia sẻ vì hệ thống chưa sẵn sàng.');
            return;
        }
        try {
            setStatus(`Đang chuẩn bị chia sẻ "${file.originalName}"...`);
            const response = await fetch(file.streamUrl, {
                credentials: 'same-origin'
            });
            if (!response.ok) {
                throw new Error('failed to download file');
            }
            const blob = await response.blob();
            const shareable = new File([blob], file.originalName, {type: file.mimeType || 'application/octet-stream'});
            window.Events.fire('activate-share-mode', {files: [shareable]});
            setStatus(`Đã sẵn sàng chia sẻ "${file.originalName}". Chọn thiết bị để gửi.`);
        } catch (error) {
            console.error('Unable to prepare file for sharing', error);
            setStatus('Không thể chuẩn bị tệp để chia sẻ.');
        }
    };

    const uploadFile = async () => {
        if (!fileInput.files || !fileInput.files.length) {
            return;
        }
        const selectedFile = fileInput.files[0];
        const visibility = visibilitySelect.value || 'public';

        const form = new FormData();
        form.append('file', selectedFile);
        form.append('visibility', visibility);

        uploadButton.disabled = true;
        setStatus(`Đang tải lên "${selectedFile.name}"...`);
        try {
            const response = await fetch('/api/files', {
                method: 'POST',
                body: form,
                credentials: 'same-origin'
            });
            if (!response.ok) {
                throw new Error('failed to upload');
            }
            fileInput.value = '';
            uploadButton.disabled = true;
            setStatus(`Đã tải lên thành công "${selectedFile.name}".`);
            await refreshTable();
        } catch (error) {
            console.error('Unable to upload file', error);
            setStatus('Không thể tải lên tệp. Vui lòng thử lại.');
        } finally {
            uploadButton.disabled = !fileInput.value;
        }
    };

    openButton.addEventListener('click', () => {
        openOverlay().catch((error) => console.error(error));
    });

    closeButton.addEventListener('click', closeOverlay);
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
            closeOverlay();
        }
    });

    fileInput.addEventListener('change', () => {
        uploadButton.disabled = !(fileInput.files && fileInput.files.length > 0);
    });

    uploadButton.addEventListener('click', (event) => {
        event.preventDefault();
        uploadFile().catch((error) => console.error(error));
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            if (!previewModal.hasAttribute('hidden')) {
                closePreview();
            } else if (!overlay.hasAttribute('hidden')) {
                closeOverlay();
            }
        }
    });

    closePreviewButton.addEventListener('click', closePreview);
    previewModal.addEventListener('click', (event) => {
        if (event.target === previewModal) {
            closePreview();
        }
    });

    downloadButton.addEventListener('click', () => {
        if (previewMeta) {
            window.open(previewMeta.downloadUrl, '_blank', 'noopener');
        }
    });

    shareButton.addEventListener('click', () => {
        if (previewMeta) {
            shareFile(previewMeta);
        }
    });

    if (window.Events && typeof window.Events.on === 'function') {
        window.Events.on('share-mode-changed', (event) => {
            if (event.detail && event.detail.active && previewMeta) {
                setStatus(`Đang chia sẻ "${previewMeta.originalName}".`);
            }
            if (event.detail && event.detail.active === false) {
                setStatus('Chế độ chia sẻ đã đóng.');
            }
        });
    }
})();
