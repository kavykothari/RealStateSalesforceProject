import { LightningElement, api } from 'lwc';
import uploadDocument
    from '@salesforce/apex/OpportunityBookingDocumentController.uploadDocument';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { RefreshEvent } from 'lightning/refresh';

const DOCUMENT_TYPES = [
    'Flat Booking Application Form',
    'KYC / Customer Information Form',
    'Booking Receipt',
    'Final Cost Sheet',
];

const MAX_FILE_SIZE = 2 * 1024 * 1024;

const ACCEPTED_EXTENSIONS = [
    '.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'
];

export default class OpportunityBookingDocuments
    extends LightningElement {

    @api recordId;

    acceptedFormats = ACCEPTED_EXTENSIONS.join(',');
    isUploading = false;
    uploadStatus = '';

    documents = DOCUMENT_TYPES.map((label, index) => ({
        key: `doc-${index + 1}`,
        label,
        icon: 'doctype:attachment',
        file: null,
        fileName: '',
        fileSizeLabel: '',
        size: 0
    }));

    get selectedCount() {
        return this.documents.filter(doc => doc.file).length;
    }

    get isSaveDisabled() {
        return this.isUploading ||
            !this.recordId ||
            this.selectedCount !== DOCUMENT_TYPES.length;
    }

    handleFileChange(event) {
        const key = event.target.dataset.key;
        const selectedFile = event.target.files?.[0];

        if (!selectedFile) {
            return;
        }

        const extensionIndex = selectedFile.name.lastIndexOf('.');
        const extension = extensionIndex >= 0
            ? selectedFile.name.substring(extensionIndex).toLowerCase()
            : '';

        if (!ACCEPTED_EXTENSIONS.includes(extension)) {
            this.showToast(
                'Unsupported file',
                'Choose a PDF, Word document, JPG or PNG file.',
                'error'
            );
            event.target.value = null;
            return;
        }

        if (selectedFile.size > MAX_FILE_SIZE) {
            this.showToast(
                'File too large',
                'Each file must be 2 MB or smaller.',
                'error'
            );
            event.target.value = null;
            return;
        }

        this.documents = this.documents.map(doc => {
            if (doc.key !== key) {
                return doc;
            }

            return {
                ...doc,
                file: selectedFile,
                fileName: selectedFile.name,
                size: selectedFile.size,
                fileSizeLabel: this.formatFileSize(selectedFile.size)
            };
        });
    }

    handleRemove(event) {
        const key = event.currentTarget.dataset.key;

        this.documents = this.documents.map(doc => {
            if (doc.key !== key) {
                return doc;
            }

            return {
                ...doc,
                file: null,
                fileName: '',
                fileSizeLabel: '',
                size: 0
            };
        });

        // Reset the native input so the same file can be selected again.
        const input = this.template.querySelector(
            `lightning-input[data-key="${key}"]`
        );

        if (input) {
            input.value = null;
        }
    }

    async handleSave() {
        if (this.isSaveDisabled) {
            return;
        }

        this.isUploading = true;

        let completed = 0;
        let failedDocument = '';

        try {
            // Upload sequentially after Save is clicked.
            for (const doc of this.documents) {
                failedDocument = doc.label;
                this.uploadStatus =
                    `Uploading ${completed + 1} of 5: ${doc.label}`;

                const base64Data = await this.readFileAsBase64(doc.file);

                await uploadDocument({
                    opportunityId: this.recordId,
                    documentType: doc.label,
                    fileName: `${doc.label.replace(/\s*\/\s*/g, ' - ')} - ${doc.fileName}`,
                    base64Data : base64Data,
                    tokenAmountReceivedAs : null
                });

                completed++;
            }

            this.showToast(
                'Success',
                'All five booking documents are attached to the Opportunity.',
                'success'
            );

            this.documents = this.documents.map(doc => ({
                ...doc,
                file: null,
                fileName: '',
                fileSizeLabel: '',
                size: 0
            }));

            this.template.querySelectorAll('lightning-input[type="file"]')
                .forEach(input => {
                    input.value = null;
                });

            this.dispatchEvent(new RefreshEvent());

        } catch (error) {
            const message = error?.body?.message ||
                error?.message ||
                'An unexpected error occurred.';

            this.showToast(
                'Upload incomplete',
                `${failedDocument}: ${message} ${completed} of 5 documents uploaded successfully. Please review the Opportunity Files related list before retrying.`,
                'error'
            );
        } finally {
            this.isUploading = false;
            this.uploadStatus = '';
        }
    }

    readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => {
                const result = reader.result;
                const base64 = result.substring(result.indexOf(',') + 1);
                resolve(base64);
            };

            reader.onerror = () => {
                reject(new Error(`Could not read ${file.name}.`));
            };

            reader.readAsDataURL(file);
        });
    }

    formatFileSize(bytes) {
        if (bytes < 1024 * 1024) {
            return `${Math.max(1, Math.round(bytes / 1024))} KB`;
        }

        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({ title, message, variant })
        );
    }
}