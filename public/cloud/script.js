// Initialize MDUI components when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize MDUI
    mdui.mutation();
    
    // Initialize event listeners
    initializeEventListeners();
    
    // Load file list
    loadFileList();
});

// Sample file data - in a real application, this would come from a server
const sampleFiles = [
    {
        name: "178463840_275456447578533_2185973562776454817_n.jpg",
        type: "image/jpeg",
        icon: "image",
        actions: ["preview", "delete"]
    },
    {
        name: "[SSA] Kobayashi-san Chi no Maid Dragon S2 Shorts - 04 [720p].mkv",
        type: "video/x-matroska",
        icon: "movie",
        actions: ["play", "delete"]
    },
    {
        name: "bakafiles",
        type: "directory",
        icon: "folder",
        actions: ["delete"]
    }
];

// Initialize event listeners
function initializeEventListeners() {
    // Refresh button
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', handleRefresh);
    }
    
    // New files button
    const newFilesBtn = document.getElementById('new-files-btn');
    if (newFilesBtn) {
        newFilesBtn.addEventListener('click', handleNewFiles);
    }
    
    // File action buttons (delegated event handling)
    const fileList = document.getElementById('file-list');
    if (fileList) {
        fileList.addEventListener('click', handleFileAction);
    }
}

// Load and display file list
function loadFileList() {
    const fileListElement = document.getElementById('file-list');
    if (!fileListElement) return;
    
    // Clear existing content
    fileListElement.innerHTML = '';
    
    // Add each file to the list
    sampleFiles.forEach(file => {
        const row = createFileRow(file);
        fileListElement.appendChild(row);
    });
}

// Create a file row element
function createFileRow(file) {
    const row = document.createElement('tr');
    
    // File name column
    const nameCell = document.createElement('td');
    nameCell.className = 'file-name';
    nameCell.innerHTML = `
        <i class="mdui-icon material-icons file-icon">${file.icon}</i>
        ${file.name}
    `;
    
    // File type column
    const typeCell = document.createElement('td');
    typeCell.className = 'file-type';
    typeCell.textContent = file.type;
    
    // Actions column
    const actionsCell = document.createElement('td');
    actionsCell.className = 'file-actions';
    
    // Create action buttons based on file type
    file.actions.forEach(action => {
        const button = document.createElement('button');
        button.className = 'mdui-btn mdui-btn-icon mdui-ripple';
        button.dataset.action = action;
        button.dataset.fileName = file.name;
        button.dataset.fileType = file.type;
        
        const icon = document.createElement('i');
        icon.className = 'mdui-icon material-icons';
        
        const actionText = document.createElement('span');
        actionText.className = 'action-text';
        
        switch(action) {
            case 'preview':
                icon.textContent = 'visibility';
                actionText.textContent = 'PREVIEW';
                button.classList.add('preview-btn');
                break;
            case 'play':
                icon.textContent = 'play_arrow';
                actionText.textContent = 'PLAY';
                button.classList.add('play-btn');
                break;
            case 'delete':
                icon.textContent = 'delete';
                actionText.textContent = 'DELETE';
                button.classList.add('delete-btn');
                break;
        }
        
        button.appendChild(icon);
        actionsCell.appendChild(button);
        actionsCell.appendChild(actionText);
    });
    
    row.appendChild(nameCell);
    row.appendChild(typeCell);
    row.appendChild(actionsCell);
    
    return row;
}

// Handle refresh button click
function handleRefresh() {
    // Show loading state
    showNotification('Refreshing file list...', 'info');
    
    // Simulate API call delay
    setTimeout(() => {
        loadFileList();
        showNotification('File list refreshed successfully!', 'success');
    }, 500);
}

// Handle new files button click
function handleNewFiles() {
    // Create file input element
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.style.display = 'none';
    
    // Handle file selection
    fileInput.addEventListener('change', function(e) {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            handleFileUpload(files);
        }
    });
    
    // Trigger file selection dialog
    document.body.appendChild(fileInput);
    fileInput.click();
    document.body.removeChild(fileInput);
}

// Handle file upload
function handleFileUpload(files) {
    showNotification(`Uploading ${files.length} file(s)...`, 'info');
    
    // Simulate upload process
    setTimeout(() => {
        files.forEach(file => {
            const fileType = file.type || 'application/octet-stream';
            let icon = 'insert_drive_file';
            
            if (fileType.startsWith('image/')) {
                icon = 'image';
            } else if (fileType.startsWith('video/')) {
                icon = 'movie';
            } else if (fileType.startsWith('audio/')) {
                icon = 'audiotrack';
            }
            
            const newFile = {
                name: file.name,
                type: fileType,
                icon: icon,
                actions: ['delete']
            };
            
            // Add preview/play actions based on file type
            if (fileType.startsWith('image/')) {
                newFile.actions.unshift('preview');
            } else if (fileType.startsWith('video/') || fileType.startsWith('audio/')) {
                newFile.actions.unshift('play');
            }
            
            sampleFiles.push(newFile);
        });
        
        loadFileList();
        showNotification(`Successfully uploaded ${files.length} file(s)!`, 'success');
    }, 1000);
}

// Handle file action button clicks
function handleFileAction(e) {
    const button = e.target.closest('.mdui-btn-icon');
    if (!button || !button.dataset.action) return;
    
    const action = button.dataset.action;
    const fileName = button.dataset.fileName;
    const fileType = button.dataset.fileType;
    
    switch(action) {
        case 'preview':
            handlePreview(fileName, fileType);
            break;
        case 'play':
            handlePlay(fileName, fileType);
            break;
        case 'delete':
            handleDelete(fileName);
            break;
    }
}

// Handle file preview
function handlePreview(fileName, fileType) {
    showNotification(`Opening preview for: ${fileName}`, 'info');
    // In a real application, this would open a preview modal or new window
}

// Handle file play
function handlePlay(fileName, fileType) {
    showNotification(`Playing: ${fileName}`, 'info');
    // In a real application, this would open a media player
}

// Handle file delete
function handleDelete(fileName) {
    // Show confirmation dialog
    const confirmed = confirm(`Are you sure you want to delete "${fileName}"?`);
    
    if (confirmed) {
        // Remove file from sample data
        const fileIndex = sampleFiles.findIndex(file => file.name === fileName);
        if (fileIndex !== -1) {
            sampleFiles.splice(fileIndex, 1);
            loadFileList();
            showNotification(`Deleted: ${fileName}`, 'success');
        }
    }
}

// Show notification using MDUI snackbar
function showNotification(message, type = 'info') {
    const snackbar = {
        message: message,
        timeout: 3000,
        position: 'bottom'
    };
    
    // Add different styling based on type
    if (type === 'success') {
        snackbar.buttonText = 'OK';
    } else if (type === 'error') {
        snackbar.buttonText = 'DISMISS';
    }
    
    mdui.snackbar(snackbar);
}

// Handle drawer toggle for mobile
function toggleDrawer() {
    const drawer = document.getElementById('main-drawer');
    if (drawer) {
        mdui.drawer(drawer).toggle();
    }
}
