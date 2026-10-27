import { LightningElement, api, wire } from 'lwc';

import getProjectConfigurationImages
    from '@salesforce/apex/ProjectConfigurationImageController.getProjectConfigurationImages';

import { refreshApex } from '@salesforce/apex';

export default class ProjectConfigurationImageSlider
    extends LightningElement {

    @api recordId;

    images = [];

    currentIndex = 0;

    isLoading = true;

    wiredResult;


    // =========================================================
    // GET IMAGES
    // =========================================================

    @wire(getProjectConfigurationImages, {
        unitId: '$recordId'
    })
    wiredImages(result) {

        this.wiredResult = result;

        const { data, error } = result;

        this.isLoading = false;

        if (data) {

            this.images = data.map((image, index) => {

                return {
                    ...image,

                    thumbnailClass:
                        index === 0
                            ? 'thumbnail active'
                            : 'thumbnail',

                    dotClass:
                        index === 0
                            ? 'dot active'
                            : 'dot'
                };

            });

            this.currentIndex = 0;

        } else if (error) {

            console.error(
                'Error loading property images:',
                error
            );

            this.images = [];
        }
    }


    // =========================================================
    // CURRENT IMAGE
    // =========================================================

    get currentImage() {

        if (!this.images.length) {
            return {};
        }

        return this.images[this.currentIndex];
    }


    // =========================================================
    // HAS IMAGES
    // =========================================================

    get hasImages() {

        return this.images.length > 0;
    }


    // =========================================================
    // IMAGE COUNTER
    // =========================================================

    get currentIndexDisplay() {

        return this.images.length
            ? this.currentIndex + 1
            : 0;
    }


    // =========================================================
    // PREVIOUS
    // =========================================================

    handlePrevious() {

        if (!this.images.length) {
            return;
        }

        this.currentIndex--;

        if (this.currentIndex < 0) {

            this.currentIndex =
                this.images.length - 1;
        }

        this.updateActiveClasses();
    }


    // =========================================================
    // NEXT
    // =========================================================

    handleNext() {

        if (!this.images.length) {
            return;
        }

        this.currentIndex++;

        if (
            this.currentIndex >=
            this.images.length
        ) {

            this.currentIndex = 0;
        }

        this.updateActiveClasses();
    }


    // =========================================================
    // THUMBNAIL
    // =========================================================

    handleThumbnail(event) {

        const index =
            Number(event.currentTarget.dataset.index);

        if (
            Number.isNaN(index) ||
            index < 0 ||
            index >= this.images.length
        ) {
            return;
        }

        this.currentIndex = index;

        this.updateActiveClasses();
    }


    // =========================================================
    // UPDATE ACTIVE THUMBNAIL
    // =========================================================

    updateActiveClasses() {

        this.images =
            this.images.map((image, index) => {

                return {
                    ...image,

                    thumbnailClass:
                        index === this.currentIndex
                            ? 'thumbnail active'
                            : 'thumbnail',

                    dotClass:
                        index === this.currentIndex
                            ? 'dot active'
                            : 'dot'
                };

            });
    }


    // =========================================================
    // IMAGE ERROR
    // =========================================================

    handleImageError(event) {

        console.error(
            'Unable to load image:',
            event.target.src
        );
    }


    // =========================================================
    // PUBLIC REFRESH
    // =========================================================

    @api
    refreshGallery() {

        if (this.wiredResult) {

            return refreshApex(
                this.wiredResult
            );
        }

        return Promise.resolve();
    }
}