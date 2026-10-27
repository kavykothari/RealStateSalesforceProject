import { LightningElement, api,wire } from 'lwc';

import uploadDocument
    from '@salesforce/apex/OpportunityBookingDocumentController.uploadDocument';

import { ShowToastEvent } from 'lightning/platformShowToastEvent';

import { getRecord, getFieldValue, updateRecord }
    from 'lightning/uiRecordApi';

import ALLOTMENT_DRAFT
    from '@salesforce/schema/Opportunity.Allotment_Letter_Draft__c';
import ALLOTMENT_EXECUTED
    from '@salesforce/schema/Opportunity.Allotment_Letter_Executed_Copy__c';
import REGISTRATION_PROOF
    from '@salesforce/schema/Opportunity.Payment_Registration_Evidence__c';
import HOME_LOAN
    from '@salesforce/schema/Opportunity.Home_Loan_Supporting_Documents__c';
import STAGE_NAME
    from '@salesforce/schema/Opportunity.StageName';

const OPPORTUNITY_FIELDS = [
    ALLOTMENT_DRAFT,
    ALLOTMENT_EXECUTED,
    REGISTRATION_PROOF,
    HOME_LOAN,
    STAGE_NAME
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const INITIAL_GROUPS = [
    {
        id: 'allotment',
        title: 'Allotment Letter',
        icon: 'standard:contract',
        description: 'Generate the draft, obtain approval and upload the executed copy.',
        documents: [
            {
                id: 'allotmentDraft',
                label: 'Allotment Letter - Draft',
                description: 'Upload the generated draft for review and approval.',
                documentType: 'Allotment Letter - Draft',
                checkboxField: ALLOTMENT_DRAFT.fieldApiName
            },
            {
                id: 'allotmentExecuted',
                label: 'Allotment Letter - Executed Copy',
                description: 'Upload the approved and executed allotment letter.',
                documentType: 'Allotment Letter - Executed Copy',
                checkboxField: ALLOTMENT_EXECUTED.fieldApiName

            }
        ]
    },
    {
        id: 'registration',
        title: 'Stamp Duty / Registration Proof',
        icon: 'standard:receipt',
        description: 'Maintain evidence of stamp duty payment and property registration.',
        documents: [
            {
                id: 'registrationProof',
                label: 'Payment / Registration Evidence',
                description: 'Upload the payment receipt, registration receipt or supporting proof.',
                documentType: 'Payment / Registration Evidence',
                checkboxField: REGISTRATION_PROOF.fieldApiName

            }
        ]
    },
    {
        id: 'loan',
        title: 'Home Loan Documents',
        icon: 'standard:account',
        description: 'Maintain bank documents for customers using home loan financing.',
        documents: [
            {
                id: 'loanDocuments',
                label: 'Home Loan Supporting Documents',
                description: 'Upload the loan sanction letter or other relevant bank documents.',
                documentType: 'Home Loan Supporting Documents',
                checkboxField: HOME_LOAN.fieldApiName
            }
        ]
    }
];

export default class PostBookingDocuments extends LightningElement {
    @api recordId;

    groups = [];
    isLoading = false;
    opportunityData;

    @wire(getRecord, {
        recordId: '$recordId',
        fields: OPPORTUNITY_FIELDS
    })
    wiredOpportunity({ data, error }) {
        if (data) {
            this.opportunityData = data;
        } else if (error) {
            this.showToast(
                'Error',
                'Unable to load Opportunity document statuses.',
                'error'
            );
        }
    }

    get visibleGroups() {
    if (!this.opportunityData) {
        return [];
    }

    const stageName = getFieldValue(
        this.opportunityData,
        STAGE_NAME
    );

    return this.groups
        .map(group => {
            // Determine whether this document section
            // should be visible at the current stage.
            let stageAllowed = false;

            switch (group.id) {
                case 'registration':
                case 'loan':
                    stageAllowed = stageName === 'Booking Done';
                    break;

                default:
                    // Keep other existing sections visible.
                    stageAllowed = true;
            }

            if (!stageAllowed) {
                return {
                    ...group,
                    documents: []
                };
            }

            return {
                ...group,
                documents: group.documents.filter(doc => {
                    const isUploaded = getFieldValue(
                        this.opportunityData,
                        `Opportunity.${doc.checkboxField}`
                    ) === true;

                    return !isUploaded;
                })
            };
        })
        .filter(group => group.documents.length > 0);
}

    connectedCallback() {
        this.groups = INITIAL_GROUPS.map(group => ({
            ...group,
            documents: group.documents.map(doc => ({
                ...doc,
                file: null,
                fileName: '',
                uploaded: false,
                uploading: false,
                buttonLabel: 'Upload Document',
                uploadDisabled: true
            })),
            statusLabel: 'Pending',
            statusClass: 'status-pending'
        }));
    }

    handleFileChange(event) {
        const groupId = event.target.dataset.groupId;
        const documentId = event.target.dataset.documentId;
        const file = event.target.files?.[0];
        const title = event.target.dataset.title;


        if (!file) {
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            this.showToast(
                'File too large',
                'Please select a file smaller than 5 MB.',
                'error'
            );
            event.target.value = null;
            return;
        }

        const allowedExtensions = [
            'pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx'
        ];

        const extension = file.name.split('.').pop().toLowerCase();

        if (!allowedExtensions.includes(extension)) {
            this.showToast(
                'Invalid file type',
                'Upload a PDF, image, DOC or DOCX file.',
                'error'
            );
            event.target.value = null;
            return;
        }

        this.updateDocument(groupId, documentId, doc => ({
            ...doc,
            file,
            fileName: title+' - '+file.name,
            uploaded: false,
            buttonLabel: 'Upload Document',
            uploadDisabled: false
        }));
    }

    async handleUpload(event) {
        const groupId = event.currentTarget.dataset.groupId;
        const documentId = event.currentTarget.dataset.documentId;
        const title = event.target.dataset.title;
        const group = this.groups.find(item => item.id === groupId);
        const doc = group?.documents.find(item => item.id === documentId);

        if (!this.recordId) {
            this.showToast(
                'Missing Opportunity',
                'Open this component on an Opportunity record.',
                'error'
            );
            return;
        }

        if (!doc?.file) {
            this.showToast(
                'Select a file',
                'Choose a document before uploading.',
                'warning'
            );
            return;
        }

        this.isLoading = true;

        this.updateDocument(groupId, documentId, item => ({
            ...item,
            uploading: true,
            uploadDisabled: true,
            buttonLabel: 'Uploading...'
        }));

       try {
                const base64Data = await this.readFileAsBase64(doc.file);

                await uploadDocument({
                    opportunityId: this.recordId,
                    documentType: doc.documentType,
                    fileName: title+' - '+doc.file.name,
                    base64Data
                });

                // Mark the corresponding Opportunity checkbox as complete.
                await updateRecord({
                    fields: {
                        Id: this.recordId,
                        [doc.checkboxField]: true
                    }
                });

                this.updateDocument(groupId, documentId, item => ({
                    ...item,
                    uploaded: true,
                    uploading: false,
                    file: null,
                    fileName: '',
                    buttonLabel: 'Uploaded',
                    uploadDisabled: true
                }));

                this.showToast(
                    'Success',
                    `${doc.label} uploaded and marked complete.`,
                    'success'
                );

            } catch (error) {
                this.updateDocument(groupId, documentId, item => ({
                    ...item,
                    uploading: false,
                    buttonLabel: 'Retry Upload',
                    uploadDisabled: false
                }));

                this.showToast(
                    'Upload / Status Update Failed',
                    this.getErrorMessage(error),
                    'error'
                );
            } finally {
                this.isLoading = false;
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

                resolve(result.split(',')[1]);
            };

            reader.onerror = () => {
                reject(new Error('Unable to read the file. Please retry.'));
            };

            reader.readAsDataURL(file);
        });
    }

    updateDocument(groupId, documentId, updater) {
        this.groups = this.groups.map(group => {
            if (group.id !== groupId) {
                return group;
            }

            return {
                ...group,
                documents: group.documents.map(doc =>
                    doc.id === documentId ? updater(doc) : doc
                )
            };
        });
    }

    updateGroupStatus(groupId) {
        this.groups = this.groups.map(group => {
            if (group.id !== groupId) {
                return group;
            }

            const uploadedCount = group.documents.filter(
                doc => doc.uploaded
            ).length;

            const allUploaded = uploadedCount === group.documents.length;

            return {
                ...group,
                statusLabel: allUploaded
                    ? 'Documents Uploaded'
                    : uploadedCount > 0
                        ? 'Partially Uploaded'
                        : 'Pending',
                statusClass: allUploaded
                    ? 'status-complete'
                    : uploadedCount > 0
                        ? 'status-partial'
                        : 'status-pending'
            };
        });
    }

    getErrorMessage(error) {
        return error?.body?.message
            || error?.message
            || 'A communication error occurred. Please retry.';
    }

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({ title, message, variant })
        );
    }
}