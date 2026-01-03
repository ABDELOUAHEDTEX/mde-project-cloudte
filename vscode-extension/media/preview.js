(function() {
    const vscode = acquireVsCodeApi();

    // Handle messages from extension
    window.addEventListener('message', event => {
        const message = event.data;
        
        switch (message.command) {
            case 'update':
                updatePreview(message.data);
                break;
        }
    });

    // Refresh button
    document.getElementById('refresh-btn').addEventListener('click', () => {
        vscode.postMessage({ command: 'refresh' });
    });

    function updatePreview(data) {
        const contentDiv = document.getElementById('content');
        
        if (!data || (!data.provider && !data.resourceCount)) {
            contentDiv.innerHTML = `
                <div class="empty-state">
                    <p>No model loaded. Generate infrastructure to see preview.</p>
                </div>
            `;
            return;
        }

        let html = '<div class="model-info">';
        
        if (data.provider) {
            html += `
                <div class="info-item">
                    <span class="info-label">Provider:</span>
                    <span class="info-value">${escapeHtml(data.provider)}</span>
                </div>
            `;
        }
        
        if (data.resourceCount !== undefined) {
            html += `
                <div class="info-item">
                    <span class="info-label">Resources:</span>
                    <span class="info-value">${data.resourceCount}</span>
                </div>
            `;
        }

        if (data.terraformFile) {
            html += `
                <div class="info-item">
                    <span class="info-label">Terraform File:</span>
                    <span class="info-value">
                        <a href="#" onclick="openTerraformFile('${escapeHtml(data.terraformFile)}')">${escapeHtml(data.terraformFile)}</a>
                    </span>
                </div>
            `;
        }

        html += '</div>';

        if (data.resources && data.resources.length > 0) {
            html += '<div class="resources-list">';
            html += '<h3>Resources</h3>';
            data.resources.forEach(resource => {
                html += `
                    <div class="resource-item">
                        <div class="resource-type">${escapeHtml(resource.type || 'Unknown')}</div>
                        <div class="resource-name">${escapeHtml(resource.name || 'Unnamed')}</div>
                        ${resource.attributes ? `<div class="resource-attributes">${escapeHtml(JSON.stringify(resource.attributes, null, 2))}</div>` : ''}
                    </div>
                `;
            });
            html += '</div>';
        }

        contentDiv.innerHTML = html;
    }

    function openTerraformFile(path) {
        vscode.postMessage({
            command: 'openTerraform',
            path: path
        });
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Expose for onclick handlers
    window.openTerraformFile = openTerraformFile;
})();

