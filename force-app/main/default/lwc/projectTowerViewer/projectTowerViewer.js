import { LightningElement, track, wire } from 'lwc';

import getProjects
    from '@salesforce/apex/ProjectTowerController.getProjects';

import getProjectDetails
    from '@salesforce/apex/ProjectTowerController.getProjectDetails';

import getTowers
    from '@salesforce/apex/ProjectTowerController.getTowers';

import { ShowToastEvent }
    from 'lightning/platformShowToastEvent';

import { NavigationMixin } from 'lightning/navigation';
import { CurrentPageReference } from 'lightning/navigation';


export default class ProjectTowerViewer extends NavigationMixin(LightningElement) {

    // =========================================================
    // VARIABLES
    // =========================================================

    @track projectOptions = [];

    @track project;

    @track towers = [];

    selectedProjectId;

    isLoading = false;

    showAmenities = false;
    opportunityId = '';



    // =========================================================
    // LOAD PROJECT OPTIONS
    // =========================================================
    @wire(CurrentPageReference)
        getPageReference(pageRef) {
            if (!pageRef) {
                return;
            }
            this.opportunityId = pageRef.state?.c__opportunityId;
        }

    @wire(getProjects)
    wiredProjects({ data, error }) {

        if (data) {

            this.projectOptions = data.map(item => {

                let label = item.name;


                if (item.projectCode) {

                    label += ` (${item.projectCode})`;

                }


                return {

                    label: label,

                    value: item.id

                };

            });

        }


        else if (error) {

            this.showToast(
                'Error',
                this.getErrorMessage(error),
                'error'
            );

        }

    }



    // =========================================================
    // PROJECT CHANGE
    // =========================================================

    handleProjectChange(event) {

        this.selectedProjectId =
            event.detail.value;


        // Reset existing data

        this.project = null;

        this.towers = [];

        this.showAmenities = false;


        if (!this.selectedProjectId) {

            return;

        }


        this.loadProjectData();

    }



    // =========================================================
    // LOAD PROJECT + TOWERS
    // =========================================================

    async loadProjectData() {

        this.isLoading = true;


        try {

            const [

                projectData,

                towerData

            ] = await Promise.all([


                getProjectDetails({

                    projectId:
                        this.selectedProjectId

                }),


                getTowers({

                    projectId:
                        this.selectedProjectId

                })

            ]);


            this.project = projectData;


            this.towers =
                (towerData || []).map(tower => {

                    return {

                        ...tower,

                        formattedPossessionDate:
                            this.formatDate(
                                tower.Planned_Possession_Date__c
                            )

                    };

                });


        }


        catch (error) {

            this.showToast(

                'Error',

                this.getErrorMessage(error),

                'error'

            );

        }


        finally {

            this.isLoading = false;

        }

    }
get formattedLocation() {
    if (!this.project) {
        return 'N/A';
    }

    const parts = [
        this.project.Location__Street__s,
        this.project.Location__City__s,
        this.project.Location__StateCode__s,
        this.project.Location__PostalCode__s,
        this.project.Location__CountryCode__s
    ].filter(value => value);

    return parts.length ? parts.join(', ') : 'N/A';
}


    // =========================================================
    // PROJECT IMAGE
    // =========================================================

    get projectImageUrl() {

        if (
            !this.project ||
            !this.project.Project_Image_Description__c
        ) {

            return null;

        }


        const html =
            this.project.Project_Image_Description__c;


        /*
         * Extract src from:
         *
         * <img src="https://....">
         */

        const match =
            html.match(
                /<img[^>]+src=["']([^"']+)["']/i
            );


        if (!match) {

            return null;

        }


        /*
         * Rich text can contain &amp;
         * in query parameters.
         */

        return match[1]
            .replace(/&amp;/g, '&');

    }



    // =========================================================
    // AMENITIES TOGGLE
    // =========================================================

    toggleAmenities() {

        this.showAmenities =
            !this.showAmenities;

    }



    // =========================================================
    // AMENITIES BUTTON LABEL
    // =========================================================

    get amenitiesButtonLabel() {

        return this.showAmenities
            ? 'Hide Amenities'
            : 'View Amenities';

    }



    // =========================================================
    // AMENITIES BUTTON ICON
    // =========================================================

    get amenitiesIcon() {

        return this.showAmenities
            ? 'utility:close'
            : 'utility:apps';

    }



    // =========================================================
    // TOWER COUNT
    // =========================================================

    get towerCount() {

        return this.towers
            ? this.towers.length
            : 0;

    }



    // =========================================================
    // HAS TOWERS
    // =========================================================

    get hasTowers() {

        return (
            this.towers &&
            this.towers.length > 0
        );

    }



    // =========================================================
    // FORMATTED RATE
    // =========================================================

    get formattedRate() {

        if (
            this.project &&
            this.project.Rate_per_Sq_Ft__c !== null &&
            this.project.Rate_per_Sq_Ft__c !== undefined
        ) {

            return new Intl.NumberFormat(
                'en-IN',
                {
                    style: 'currency',
                    currency: 'INR',
                    maximumFractionDigits: 2
                }
            ).format(
                this.project.Rate_per_Sq_Ft__c
            );

        }


        return 'N/A';

    }



    // =========================================================
    // COMPLETION DATE
    // =========================================================

    get formattedCompletionDate() {

        return this.formatDate(

            this.project?.Expected_Completion_Date__c

        );

    }



    // =========================================================
    // ANNOUNCEMENT DATE
    // =========================================================

    get formattedAnnouncementDate() {

        return this.formatDate(

            this.project?.Announcement_Date__c

        );

    }



    // =========================================================
    // LAUNCH DATE
    // =========================================================

    get formattedLaunchDate() {

        return this.formatDate(

            this.project?.Launch_Date__c

        );

    }



    // =========================================================
    // CONSTRUCTION START DATE
    // =========================================================

    get formattedConstructionStartDate() {

        return this.formatDate(

            this.project?.Construction_Start_Date__c

        );

    }



    // =========================================================
    // RERA REGISTRATION DATE
    // =========================================================

    get formattedReraRegistrationDate() {

        return this.formatDate(

            this.project?.RERA_Registration_Date__c

        );

    }



    // =========================================================
    // RERA EXPIRY DATE
    // =========================================================

    get formattedReraExpiryDate() {

        return this.formatDate(

            this.project?.RERA_Expiry_Date__c

        );

    }



    // =========================================================
    // DATE FORMATTER
    // =========================================================

    formatDate(value) {

        if (!value) {

            return 'N/A';

        }


        try {

            return new Intl.DateTimeFormat(

                'en-IN',

                {

                    day: '2-digit',

                    month: 'short',

                    year: 'numeric'

                }

            ).format(

                new Date(value)

            );

        }


        catch (error) {

            return value;

        }

    }



    // =========================================================
    // ERROR MESSAGE
    // =========================================================

    getErrorMessage(error) {

        if (
            error?.body?.message
        ) {

            return error.body.message;

        }


        if (
            error?.message
        ) {

            return error.message;

        }


        return 'An unexpected error occurred.';

    }



    // =========================================================
    // TOAST
    // =========================================================

    showToast(
        title,
        message,
        variant
    ) {

        this.dispatchEvent(

            new ShowToastEvent({

                title,

                message,

                variant

            })

        );

    }

    handleTowerClick(event) {
        const towerId = event.currentTarget.dataset.towerId;

        if (!towerId) {
            return;
        }

        const pageReference = {
            type: 'standard__navItemPage',
            attributes: {
                apiName: 'Tower_Inventory'
            },
            state: {
                c__towerId: towerId,
                c__opportunityId: this.opportunityId
            }
        };

        this[NavigationMixin.GenerateUrl](pageReference)
            .then((url) => {
                window.open(url, '_blank');
            });
    }

}