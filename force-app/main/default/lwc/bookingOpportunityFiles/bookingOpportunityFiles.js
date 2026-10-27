import { LightningElement, api, wire } from 'lwc';

import getOpportunityFiles
    from '@salesforce/apex/BookingOpportunityFilesController.getOpportunityFiles';

import getVerificationStatus
    from '@salesforce/apex/BookingOpportunityFilesController.getVerificationStatus';

import replaceFile
    from '@salesforce/apex/BookingOpportunityFilesController.replaceFile';

import verifyAllDocuments
    from '@salesforce/apex/BookingOpportunityFilesController.verifyAllDocuments';

import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_EXTENSIONS = [
    'pdf',
    'doc',
    'docx',
    'jpg',
    'jpeg',
    'png'
];

export default class BookingOpportunityFiles extends LightningElement {

    @api recordId;

    files = [];
    documentsVerified = false;

    isLoading = true;
    isBusy = false;

    filesWireResult;
    verificationWireResult;

    // =========================================================
    // LOAD OPPORTUNITY FILES
    // =========================================================
    // File preview modal state
    isPreviewModalOpen = false;
    previewUrl;
    previewTitle;

    // Open the selected file in the modal
    handleFileNameClick(event) {
    event.preventDefault();

    const contentDocumentId = event.currentTarget.dataset.id;
    const title = event.currentTarget.dataset.title;

    const selectedFile = this.files.find(
        file => file.contentDocumentId === contentDocumentId
    );

    if (!selectedFile?.latestPublishedVersionId) {
        this.showToast(
            'Preview unavailable',
            'The published version of this file could not be found.',
            'error'
        );
        return;
    }

    const versionId = selectedFile.latestPublishedVersionId;
    const fileType = (selectedFile.fileType || '').toUpperCase();

    this.previewTitle = title || 'File Preview';

    if (fileType === 'PDF') {
        this.previewUrl =
            '/sfc/servlet.shepherd/version/renditionDownload' +
            '?rendition=ORIGINAL_Pdf&versionId=' +
            encodeURIComponent(versionId);
    } else if (
        ['PNG', 'JPG', 'JPEG', 'GIF'].includes(fileType)
    ) {
        this.previewUrl =
            '/sfc/servlet.shepherd/version/download/' +
            encodeURIComponent(versionId);
    } else {
        this.showToast(
            'Preview unavailable',
            'Inline preview is supported here for PDFs. Other file types may need to be opened separately.',
            'info'
        );
        return;
    }

    this.isPreviewModalOpen = true;
}

showToast(title, message, variant) {
    this.dispatchEvent(
        new ShowToastEvent({
            title,
            message,
            variant
        })
    );
}

    // Close the modal
    closePreviewModal() {
        this.isPreviewModalOpen = false;
        this.previewUrl = undefined;
        this.previewTitle = undefined;
    }

    @wire(getOpportunityFiles, { bookingId: '$recordId' })
    wiredFiles(result) {

        this.filesWireResult = result;

        if (result.data) {

            this.files = result.data.map(file => ({
                ...file,

                showPicker: false,

                url:
                    `/lightning/r/ContentDocument/` +
                    `${file.contentDocumentId}/view`
            }));

            this.isLoading = false;

        } else if (result.error) {

            this.files = [];
            this.isLoading = false;

            this.showToast(
                'Unable to Load Documents',
                this.getErrorMessage(result.error),
                'error'
            );
        }
    }

    // =========================================================
    // LOAD DOCUMENT VERIFICATION STATUS
    // =========================================================

    @wire(getVerificationStatus, { bookingId: '$recordId' })
    wiredVerification(result) {

        this.verificationWireResult = result;

        if (result.data !== undefined) {

            this.documentsVerified = result.data === true;

        } else if (result.error) {

            this.showToast(
                'Unable to Load Verification Status',
                this.getErrorMessage(result.error),
                'error'
            );
        }
    }

    // =========================================================
    // GETTERS
    // =========================================================

    get hasFiles() {
        return this.files.length > 0;
    }

    // =========================================================
    // CLICK REPLACE FILE
    // Shows the file picker for the selected document.
    // =========================================================

    handleReplaceClick(event) {

        if (this.documentsVerified || this.isBusy) {
            return;
        }

        const fileId = event.currentTarget.dataset.fileId;

        this.files = this.files.map(file => ({
            ...file,

            showPicker:
                file.contentDocumentId === fileId
        }));
    }

    // =========================================================
    // CANCEL REPLACEMENT
    // =========================================================

    handleCancelReplace(event) {

        const fileId = event.currentTarget.dataset.fileId;

        this.files = this.files.map(file => ({
            ...file,

            showPicker:
                file.contentDocumentId === fileId
                    ? false
                    : file.showPicker
        }));
    }

    // =========================================================
    // SELECT AND REPLACE FILE
    // =========================================================

    async handleFileSelection(event) {

        const input = event.target;

        const oldFileId = input.dataset.fileId;

        const selectedFiles = input.files;

        if (!selectedFiles || selectedFiles.length === 0) {
            return;
        }

        const file = selectedFiles[0];

        // Never allow replacement after verification.
        if (this.documentsVerified) {

            input.value = null;

            this.showToast(
                'Documents Locked',
                'Verified documents cannot be replaced.',
                'error'
            );

            return;
        }

        // Validate extension.
        const nameParts = file.name.split('.');

        const extension = nameParts.length > 1
            ? nameParts.pop().toLowerCase()
            : '';

        if (!ALLOWED_EXTENSIONS.includes(extension)) {

            input.value = null;

            this.showToast(
                'Invalid File',
                'Allowed file types: PDF, DOC, DOCX, JPG, JPEG and PNG.',
                'error'
            );

            return;
        }

        // Validate file size.
        if (file.size === 0) {

            input.value = null;

            this.showToast(
                'Empty File',
                'Please select a file that contains data.',
                'error'
            );

            return;
        }

        if (file.size > MAX_FILE_SIZE) {

            input.value = null;

            this.showToast(
                'File Too Large',
                'The maximum replacement file size is 5 MB.',
                'error'
            );

            return;
        }

        this.isBusy = true;

        try {

            // Read the selected file as Base64.
            const base64Data = await this.readFileAsBase64(file);

            // Apex uploads the new file and removes the old file link.
            await replaceFile({
                bookingId: this.recordId,
                oldContentDocumentId: oldFileId,
                fileName: file.name,
                base64Data: base64Data
            });

            // Refresh the list and verification status.
            await this.refreshData();

            this.showToast(
                'Success',
                'The document has been replaced successfully.',
                'success'
            );

        } catch (error) {

            this.showToast(
                'Replacement Failed',
                this.getErrorMessage(error),
                'error'
            );

        } finally {

            this.isBusy = false;

            // Allow the same file to be selected again.
            input.value = null;
        }
    }

    // =========================================================
    // READ FILE AS BASE64
    // =========================================================

    readFileAsBase64(file) {

        return new Promise((resolve, reject) => {

            const reader = new FileReader();

            reader.onload = () => {

                const result = reader.result;

                if (typeof result !== 'string') {
                    reject(
                        new Error('Unable to read the selected file.')
                    );
                    return;
                }

                const commaIndex = result.indexOf(',');

                if (commaIndex === -1) {
                    reject(
                        new Error('Invalid file data.')
                    );
                    return;
                }

                resolve(result.substring(commaIndex + 1));
            };

            reader.onerror = () => {
                reject(
                    new Error('Unable to read the selected file.')
                );
            };

            reader.readAsDataURL(file);
        });
    }

    // =========================================================
    // VERIFY ALL DOCUMENTS
    // =========================================================

    async handleVerificationChange(event) {

        const checkbox = event.target;

        // Do not allow unchecking after verification.
        if (this.documentsVerified) {
            checkbox.checked = true;
            return;
        }

        // Only process the checked action.
        if (!checkbox.checked) {
            return;
        }

        // Wait for Apex before displaying the permanent state.
        checkbox.checked = false;

        this.isBusy = true;

        try {

            await verifyAllDocuments({
                bookingId: this.recordId
            });

            this.documentsVerified = true;

            await this.refreshData();

            this.showToast(
                'Documents Verified',
                'All documents have been verified. File replacement is now locked.',
                'success'
            );

            window.location.reload();

        } catch (error) {

            this.showToast(
                'Verification Failed',
                this.getErrorMessage(error),
                'error'
            );

        } finally {

            this.isBusy = false;
        }
    }

    // =========================================================
    // MANUAL REFRESH
    // =========================================================

    async handleRefresh() {

        if (this.isBusy) {
            return;
        }

        this.isBusy = true;

        try {

            await this.refreshData();

            this.showToast(
                'Refreshed',
                'Booking documents have been refreshed.',
                'success'
            );

        } catch (error) {

            this.showToast(
                'Refresh Failed',
                this.getErrorMessage(error),
                'error'
            );

        } finally {

            this.isBusy = false;
        }
    }

    // =========================================================
    // REFRESH WIRED DATA
    // =========================================================

    async refreshData() {

        const refreshTasks = [];

        if (this.filesWireResult) {
            refreshTasks.push(
                refreshApex(this.filesWireResult)
            );
        }

        if (this.verificationWireResult) {
            refreshTasks.push(
                refreshApex(this.verificationWireResult)
            );
        }

        await Promise.all(refreshTasks);
    }

    // =========================================================
    // ERROR MESSAGE
    // =========================================================

    getErrorMessage(error) {

        if (error?.body?.message) {
            return error.body.message;
        }

        if (error?.body?.pageErrors?.length) {
            return error.body.pageErrors[0].message;
        }

        if (error?.message) {
            return error.message;
        }

        return 'An unexpected error occurred. Please try again.';
    }

    // =========================================================
    // TOAST
    // =========================================================

    showToast(title, message, variant) {

        this.dispatchEvent(
            new ShowToastEvent({
                title: title,
                message: message,
                variant: variant
            })
        );
    }
}