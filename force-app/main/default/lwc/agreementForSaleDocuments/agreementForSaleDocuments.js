import { LightningElement, api, wire } from 'lwc';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import { refreshApex } from '@salesforce/apex';
import { RefreshEvent } from 'lightning/refresh';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

import uploadAgreementDocument
    from '@salesforce/apex/BookingOpportunityFilesController.uploadAgreementDocument';

import DRAFT_FIELD
    from '@salesforce/schema/Booking__c.Agreement_for_Sale_Draft__c';
import EXECUTED_FIELD
    from '@salesforce/schema/Booking__c.Agreement_for_Sale_Executed_Copy__c';

const FIELDS = [DRAFT_FIELD, EXECUTED_FIELD];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_EXTENSIONS = [
    'pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'
];

export default class AgreementForSaleDocuments extends LightningElement {
    @api recordId;

    draftFile;
    executedFile;

    draftFileName = '';
    executedFileName = '';

    draftUploading = false;
    executedUploading = false;

    wiredBookingResult;

    @wire(getRecord, {
        recordId: '$recordId',
        fields: FIELDS
    })
    wiredBooking(result) {
        this.wiredBookingResult = result;
    }

    get draftVerified() {
        return this.wiredBookingResult?.data
            ? getFieldValue(this.wiredBookingResult.data, DRAFT_FIELD)
            : false;
    }

    get executedVerified() {
        return this.wiredBookingResult?.data
            ? getFieldValue(this.wiredBookingResult.data, EXECUTED_FIELD)
            : false;
    }

    get draftButtonLabel() {
        return this.draftVerified ? 'Replace Draft' : 'Upload Draft';
    }

    get executedButtonLabel() {
        return this.executedVerified
            ? 'Replace Executed Copy'
            : 'Upload Executed Copy';
    }

    get draftUploadDisabled() {
        return !this.draftFile || this.draftUploading;
    }

    get executedUploadDisabled() {
        return !this.executedFile || this.executedUploading;
    }

    handleFileChange(event) {
        const file = event.target.files?.[0];
        const documentType = event.target.dataset.doctype;

        if (!file) {
            return;
        }

        const extension = file.name.includes('.')
            ? file.name.split('.').pop().toLowerCase()
            : '';

        if (!ALLOWED_EXTENSIONS.includes(extension)) {
            this.showToast(
                'Invalid file type',
                'Upload a PDF, DOC, DOCX, JPG, JPEG, or PNG file.',
                'error'
            );
            event.target.value = null;
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            this.showToast(
                'File too large',
                'The maximum allowed file size is 5 MB.',
                'error'
            );
            event.target.value = null;
            return;
        }

        if (documentType === 'DRAFT') {
            this.draftFile = file;
            this.draftFileName = file.name;
        } else if (documentType === 'EXECUTED') {
            this.executedFile = file;
            this.executedFileName = file.name;
        }
    }

    uploadDraft() {
        this.uploadDocument('DRAFT');
    }

    uploadExecuted() {
        this.uploadDocument('EXECUTED');
    }

    async uploadDocument(documentType) {
        const isDraft = documentType === 'DRAFT';
        const file = isDraft ? this.draftFile : this.executedFile;

        if (!this.recordId || !file) {
            this.showToast(
                'Unable to upload',
                'Booking record or selected file is missing.',
                'error'
            );
            return;
        }

        if (isDraft) {
            this.draftUploading = true;
        } else {
            this.executedUploading = true;
        }

        try {
            const base64Data = await this.readFileAsBase64(file);

            await uploadAgreementDocument({
                bookingId: this.recordId,
                documentType,
                fileName: file.name,
                base64Data
            });

            if (isDraft) {
                this.draftFile = null;
                this.draftFileName = '';
            } else {
                this.executedFile = null;
                this.executedFileName = '';
            }

            if (this.wiredBookingResult) {
                await refreshApex(this.wiredBookingResult);
            }

            this.dispatchEvent(new RefreshEvent());

            this.showToast(
                'Upload successful',
                isDraft
                    ? 'Agreement for Sale Draft uploaded successfully.'
                    : 'Agreement for Sale Executed Copy uploaded successfully.',
                'success'
            );
        } catch (error) {
            this.showToast(
                'Upload failed',
                this.getErrorMessage(error),
                'error'
            );
        } finally {
            if (isDraft) {
                this.draftUploading = false;
            } else {
                this.executedUploading = false;
            }
        }
    }

    readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => {
                const result = reader.result;

                if (typeof result !== 'string' || !result.includes(',')) {
                    reject(new Error('Unable to read the selected file.'));
                    return;
                }

                resolve(result.substring(result.indexOf(',') + 1));
            };

            reader.onerror = () => {
                reject(new Error('Error reading the selected file.'));
            };

            reader.readAsDataURL(file);
        });
    }

    getErrorMessage(error) {
        if (error?.body?.message) {
            return error.body.message;
        }

        if (error?.message) {
            return error.message;
        }

        return 'An unexpected error occurred while uploading the file.';
    }

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({ title, message, variant })
        );
    }
}