(function () {
    const statusLabel = document.getElementById('drive-status');
    const listEl = document.getElementById('drive-list');
    const emptyState = document.getElementById('drive-empty');
    const viewToggle = document.getElementById('view-toggle');
    const viewToggleIcon = document.getElementById('view-toggle-icon');
    const refreshButton = document.getElementById('refresh-button');
    const filterSelect = document.getElementById('visibility-filter');
    const openUploadButton = document.getElementById('open-upload');
    const uploadDialogEl = document.getElementById('upload-dialog');
    const uploadFileInput = document.getElementById('upload-file-input');
    const uploadFileName = document.getElementById('upload-file-name');
    const uploadVisibility = document.getElementById('upload-visibility');
    const cancelUploadButton = document.getElementById('cancel-upload');
    const confirmUploadButton = document.getElementById('confirm-upload');

    const previewDialogEl = document.getElementById('preview-dialog');
    const previewTitle = document.getElementById('preview-title');
    const previewBody = document.getElementById('preview-body');
    const downloadButton = document.getElementById('download-file');
    const shareButton = document.getElementById('share-file');
    const closePreviewButton = document.getElementById('close-preview');

    if (!statusLabel || !listEl) {
        return;
    }

    const uploadDialog = new mdui.Dialog(uploadDialogEl, {history: false});
    const previewDialog = new mdui.Dialog(previewDialogEl, {history: false});

    let files = [];
    let viewMode = 'grid';
    let previewMeta = null;

    const formatBytes = (bytes) => {
        if (!Number.isFinite(bytes)) {
            return '—';
        }
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const index = bytes > 0 ? Math.floor(Math.log(bytes) / Math.log(1024)) : 0;
        const value = bytes / Math.pow(1024, index);
        return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
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

    const showStatus = (message, opts = {}) => {
        statusLabel.textContent = message;
        if (opts.toast) {
            mdui.snackbar({
                message,
                position: 'right-bottom',
                timeout: 2400
            });
        }
    };

    const requestFiles = async () => {
        const visibility = filterSelect ? filterSelect.value : 'all';
        const query = visibility && visibility !== 'all' ? `?visibility=${visibility}` : '';
        const response = await fetch(`/api/files${query}`, {
            credentials: 'same-origin'
        });
        if (!response.ok) {
            throw new Error('failed to fetch files');
        }
        const payload = await response.json();
        return Array.isArray(payload.files) ? payload.files : [];
    };

    const updateEmptyState = () => {
        if (!files.length) {
            emptyState.removeAttribute('hidden');
            listEl.innerHTML = '';
        } else {
            emptyState.setAttribute('hidden', '');
        }
    };

    const iconForMime = (mime) => {
        if (!mime) return 'insert_drive_file';
        if (mime.startsWith('image/')) return 'image';
        if (mime.startsWith('video/')) return 'movie';
        if (mime.startsWith('audio/')) return 'audiotrack';
        if (mime === 'application/pdf') return 'picture_as_pdf';
        if (mime.includes('zip') || mime.includes('compressed')) return 'folder_zip';
        if (mime.includes('spreadsheet') || mime.includes('excel')) return 'table_chart';
        if (mime.includes('presentation')) return 'slideshow';
        if (mime.includes('word') || mime.includes('document')) return 'description';
        return 'insert_drive_file';
    };

    const openPreview = (file) => {
        previewMeta = file;
        previewTitle.textContent = file.originalName;
        previewBody.innerHTML = '';

        const mime = (file.mimeType || '').toLowerCase();
        if (mime.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = file.streamUrl;
            img.alt = file.originalName;
            img.className = 'preview-image';
            previewBody.appendChild(img);
        } else if (mime === 'application/pdf') {
            const frame = document.createElement('iframe');
            frame.src = file.streamUrl;
            frame.title = file.originalName;
            frame.className = 'preview-frame';
            frame.loading = 'lazy';
            previewBody.appendChild(frame);
        } else if (mime.startsWith('video/')) {
            const video = document.createElement('video');
            video.src = file.streamUrl;
            video.controls = true;
            video.className = 'preview-video';
            previewBody.appendChild(video);
        } else if (mime.startsWith('audio/')) {
            const audio = document.createElement('audio');
            audio.src = file.streamUrl;
            audio.controls = true;
            audio.className = 'preview-audio';
            previewBody.appendChild(audio);
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'preview-placeholder';
            placeholder.innerHTML = 'Không có bản xem trước cho loại tệp này.<br>Vui lòng tải xuống để xem nội dung.';
            previewBody.appendChild(placeholder);
        }

        previewDialog.open();
    };

    const deleteFile = async (file) => {
        if (!confirm(`Bạn có chắc muốn xóa "${file.originalName}"?`)) {
            return;
        }
        showStatus(`Đang xóa "${file.originalName}"...`);
        const response = await fetch(`/api/files/${file.id}`, {
            method: 'DELETE',
            credentials: 'same-origin'
        });
        if (!response.ok && response.status !== 204) {
            throw new Error('failed to delete');
        }
        showStatus(`Đã xóa "${file.originalName}".`, {toast: true});
    };

    const toggleVisibility = async (file) => {
        const next = file.visibility === 'private' ? 'public' : 'private';
        showStatus('Đang cập nhật quyền truy cập...');
        const response = await fetch(`/api/files/${file.id}`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            credentials: 'same-origin',
            body: JSON.stringify({visibility: next})
        });
        if (!response.ok) {
            throw new Error('failed to toggle visibility');
        }
        showStatus(`Đã chuyển sang chế độ ${next === 'private' ? 'riêng tư' : 'công khai'}.`, {toast: true});
    };

    const shareFile = async (file) => {
        if (!window.Events || typeof window.Events.fire !== 'function') {
            showStatus('Không thể chia sẻ: hệ thống chưa sẵn sàng.');
            return;
        }
        showStatus(`Đang chuẩn bị chia sẻ "${file.originalName}"...`);
        const response = await fetch(file.streamUrl, {
            credentials: 'same-origin'
        });
        if (!response.ok) {
            throw new Error('failed to fetch file');
        }
        const blob = await response.blob();
        const shareable = new File([blob], file.originalName, {
            type: file.mimeType || 'application/octet-stream'
        });
        window.Events.fire('activate-share-mode', {files: [shareable]});
        showStatus(`Đã sẵn sàng chia sẻ "${file.originalName}".`, {toast: true});
    };

    const buildActionButton = (icon, tooltip) => {
        const btn = document.createElement('button');
        btn.className = 'mdui-btn mdui-btn-icon mdui-ripple drive-action';
        btn.innerHTML = `<span class="material-icons">${icon}</span>`;
        btn.setAttribute('title', tooltip);
        return btn;
    };

    const createGridItem = (file) => {
        const card = document.createElement('div');
        card.className = 'drive-item drive-item-grid mdui-card mdui-hoverable';

        const thumbnail = document.createElement('div');
        thumbnail.className = 'drive-item-thumbnail';
        thumbnail.innerHTML = `<span class="material-icons">${iconForMime(file.mimeType)}</span>`;
        card.appendChild(thumbnail);

        const title = document.createElement('div');
        title.className = 'drive-item-title';
        title.textContent = file.originalName;
        card.appendChild(title);

        const meta = document.createElement('div');
        meta.className = 'drive-item-meta';
        meta.textContent = `${formatBytes(file.size)} • ${file.visibility === 'private' ? 'Riêng tư' : 'Công khai'}`;
        card.appendChild(meta);

        const actions = document.createElement('div');
        actions.className = 'drive-item-actions';

        const previewBtn = buildActionButton('visibility', 'Xem trước');
        previewBtn.addEventListener('click', () => openPreview(file));

        const shareBtn = buildActionButton('send', 'Chia sẻ');
        shareBtn.addEventListener('click', () => shareFile(file).catch(handleError));

        const visibilityBtn = buildActionButton(file.visibility === 'private' ? 'lock_open' : 'lock', 'Đổi quyền');
        visibilityBtn.addEventListener('click', () => toggleVisibility(file).then(refreshFiles).catch(handleError));

        const deleteBtn = buildActionButton('delete', 'Xóa');
        deleteBtn.addEventListener('click', () => deleteFile(file).then(refreshFiles).catch(handleError));

        actions.append(previewBtn, shareBtn, visibilityBtn, deleteBtn);
        card.appendChild(actions);

        card.addEventListener('dblclick', () => openPreview(file));

        return card;
    };

    const createListItem = (file) => {
        const row = document.createElement('div');
        row.className = 'drive-item drive-item-list';

        const info = document.createElement('div');
        info.className = 'drive-item-info';
        info.innerHTML = `
            <span class="material-icons drive-item-icon">${iconForMime(file.mimeType)}</span>
            <div class="drive-item-text">
                <span class="drive-item-name">${file.originalName}</span>
                <span class="drive-item-sub">${formatDateTime(file.createdAt)} · ${formatBytes(file.size)}</span>
            </div>
        `;
        info.addEventListener('click', () => openPreview(file));

        const controls = document.createElement('div');
        controls.className = 'drive-item-controls';

        const shareBtn = buildActionButton('send', 'Chia sẻ');
        shareBtn.addEventListener('click', () => shareFile(file).catch(handleError));

        const visibilityBtn = buildActionButton(file.visibility === 'private' ? 'lock_open' : 'lock', 'Đổi quyền');
        visibilityBtn.addEventListener('click', () => toggleVisibility(file).then(refreshFiles).catch(handleError));

        const deleteBtn = buildActionButton('delete', 'Xóa');
        deleteBtn.addEventListener('click', () => deleteFile(file).then(refreshFiles).catch(handleError));

        controls.append(shareBtn, visibilityBtn, deleteBtn);

        row.append(info, controls);
        return row;
    };

    const renderFiles = () => {
        listEl.innerHTML = '';
        listEl.classList.toggle('list-mode', viewMode === 'list');
        updateEmptyState();
        if (!files.length) {
            return;
        }

        const fragment = document.createDocumentFragment();
        files.forEach((file) => {
            fragment.appendChild(viewMode === 'grid' ? createGridItem(file) : createListItem(file));
        });
        listEl.appendChild(fragment);
    };

    const handleError = (error) => {
        console.error(error);
        showStatus('Có lỗi xảy ra. Vui lòng thử lại.', {toast: true});
    };

    const refreshFiles = async () => {
        try {
            showStatus('Đang tải danh sách tệp...');
            files = await requestFiles();
            files.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            renderFiles();
            showStatus('Đã cập nhật danh sách tệp.');
        } catch (error) {
            handleError(error);
        }
    };

    const resetUploadDialog = () => {
        uploadFileInput.value = '';
        uploadFileName.textContent = 'Chưa chọn tệp.';
        confirmUploadButton.disabled = true;
    };

    const uploadFile = async () => {
        if (!uploadFileInput.files || !uploadFileInput.files.length) {
            return;
        }
        const file = uploadFileInput.files[0];
        const visibility = uploadVisibility.value || 'public';

        const form = new FormData();
        form.append('file', file);
        form.append('visibility', visibility);

        confirmUploadButton.disabled = true;
        showStatus(`Đang tải lên "${file.name}"...`);
        const response = await fetch('/api/files', {
            method: 'POST',
            body: form,
            credentials: 'same-origin'
        });
        if (!response.ok) {
            throw new Error('failed to upload');
        }
        showStatus(`Đã tải lên "${file.name}".`, {toast: true});
    };

    viewToggle.addEventListener('click', () => {
        viewMode = viewMode === 'grid' ? 'list' : 'grid';
        viewToggleIcon.textContent = viewMode === 'grid' ? 'grid_view' : 'view_agenda';
        renderFiles();
    });

    refreshButton.addEventListener('click', () => {
        refreshFiles().catch(handleError);
    });

    if (filterSelect) {
        filterSelect.addEventListener('change', () => {
            refreshFiles().catch(handleError);
        });
    }

    openUploadButton.addEventListener('click', () => {
        resetUploadDialog();
        uploadDialog.open();
    });

    cancelUploadButton.addEventListener('click', () => {
        uploadDialog.close();
    });

    uploadFileInput.addEventListener('change', () => {
        if (uploadFileInput.files && uploadFileInput.files.length) {
            const file = uploadFileInput.files[0];
            uploadFileName.textContent = `${file.name} (${formatBytes(file.size)})`;
            confirmUploadButton.disabled = false;
        } else {
            uploadFileName.textContent = 'Chưa chọn tệp.';
            confirmUploadButton.disabled = true;
        }
    });

    confirmUploadButton.addEventListener('click', (event) => {
        event.preventDefault();
        uploadFile()
            .then(() => {
                uploadDialog.close();
                return refreshFiles();
            })
            .catch((error) => {
                confirmUploadButton.disabled = false;
                handleError(error);
            });
    });

    downloadButton.addEventListener('click', () => {
        if (previewMeta) {
            window.open(previewMeta.downloadUrl, '_blank', 'noopener');
        }
    });

    shareButton.addEventListener('click', () => {
        if (previewMeta) {
            shareFile(previewMeta).catch(handleError);
        }
    });

    closePreviewButton.addEventListener('click', () => {
        previewDialog.close();
    });

    previewDialogEl.addEventListener('closed.mdui.dialog', () => {
        previewMeta = null;
        previewBody.innerHTML = '<div class="preview-placeholder">Đang chuẩn bị bản xem trước...</div>';
    });

    if (window.mdui && typeof window.mdui.mutation === 'function') {
        window.mdui.mutation();
    }

    refreshFiles().catch(handleError);
})();
