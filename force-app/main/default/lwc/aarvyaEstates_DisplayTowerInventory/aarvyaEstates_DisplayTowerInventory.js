import { LightningElement, wire } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import getTowerInventory from '@salesforce/apex/AarvyaEstates_TowerInventoryController.getTowerInventory';
import { refreshApex } from '@salesforce/apex';
import {
    ShowToastEvent
} from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';

const STATUS = {
    AVAILABLE: 'Available',
    HOLD: 'Reserved (On Hold)',
    BOOKED: 'Booked'
};

export default class TowerInventory extends NavigationMixin(LightningElement)  {

    towerId;
    wiredInventoryResult;
    inventory;
    error;
    isLoading = true;
selectedUnitId = null;
    searchTerm = '';

    configurationFilter = 'All';
    availabilityFilter = 'All';
    facingFilter = 'All';
    viewFilter = 'All';
    floorFilter = 'All';
    possessionFilter = 'All';
    constructionFilter = 'All';

    showMoreFilters = false;

    selectedRangeStart = null;
    selectedRangeEnd = null;
    showUnitDetails = false;

    floorJump = '';
    opportunityId = '';

    @wire(CurrentPageReference)
    getPageReference(pageReference) {

        const id =
            pageReference &&
            pageReference.state
                ? pageReference.state.c__towerId
                : null;
        this.opportunityId = pageReference.state?.c__opportunityId;

        if (id && id !== this.towerId) {

            this.towerId = id;

        } else if (!id) {

            this.isLoading = false;

            this.error =
                'No Tower Id was provided. Open Tower Inventory from a tower card.';
        }
    }



@wire(getTowerInventory, { towerId: '$towerId' })
wiredInventory(result) {

    this.wiredInventoryResult = result;

    const { data, error } = result;

    if (data) {
        this.inventory = data;
        this.setInitialRange();
        this.isLoading = false;
    }

    if (error) {
        this.error = this.reduceError(error);
        this.isLoading = false;
    }
}


    setInitialRange() {

        const total =
            this.inventory &&
            this.inventory.totalFloors
                ? this.inventory.totalFloors
                : 0;

        if (!total) {

            this.selectedRangeStart = null;
            this.selectedRangeEnd = null;

            return;
        }

        const start =
            Math.floor(
                (total - 1) / 10
            ) * 10 + 1;

        this.selectedRangeStart = start;

        this.selectedRangeEnd =
            Math.min(
                start + 9,
                total
            );
    }

    get towerName() {

        return this.inventory &&
            this.inventory.towerName
            ? this.inventory.towerName
            : 'Tower';
    }

    get totalFloors() {

        return this.inventory &&
            this.inventory.totalFloors
            ? this.inventory.totalFloors
            : 0;
    }

    get totalUnits() {

        return this.inventory &&
            this.inventory.totalUnits
            ? this.inventory.totalUnits
            : 0;
    }

    get availableCount() {

        return this.inventory &&
            this.inventory.availableCount
            ? this.inventory.availableCount
            : 0;
    }

    get onHoldCount() {

        return this.inventory &&
            this.inventory.onHoldCount
            ? this.inventory.onHoldCount
            : 0;
    }

    get bookedCount() {

        return this.inventory &&
            this.inventory.bookedCount
            ? this.inventory.bookedCount
            : 0;
    }

    get configurationOptions() {

        return this.picklistOptions(
            'configuration'
        );
    }

    get availabilityOptions() {

        return [
            {
                label: 'All',
                value: 'All'
            },
            {
                label: STATUS.AVAILABLE,
                value: STATUS.AVAILABLE
            },
            {
                label: STATUS.HOLD,
                value: STATUS.HOLD
            },
            {
                label: STATUS.BOOKED,
                value: STATUS.BOOKED
            }
        ];
    }

    get facingOptions() {

        return this.picklistOptions(
            'facing'
        );
    }

    get viewOptions() {

        return this.picklistOptions(
            'view'
        );
    }

    get possessionOptions() {

        return this.picklistOptions(
            'possessionStatus'
        );
    }

    get constructionOptions() {

        return this.picklistOptions(
            'constructionStatus'
        );
    }

    get floorOptions() {

        const floors =
            this.inventory &&
            this.inventory.floors
                ? this.inventory.floors
                : [];

        const values =
            floors.map((floor) => ({
                label: floor.floorNumber,
                value: floor.id
            }));

        return [
            {
                label: 'All Floors',
                value: 'All'
            },
            ...values
        ];
    }

    picklistOptions(field) {

        const labels = new Set();

        const floors =
            this.inventory &&
            this.inventory.floors
                ? this.inventory.floors
                : [];

        floors.forEach((floor) => {

            floor.units.forEach((unit) => {

                if (unit[field]) {

                    labels.add(
                        unit[field]
                    );
                }
            });
        });

        return [
            {
                label: 'All',
                value: 'All'
            },

            ...Array.from(labels)
                .sort(
                    (a, b) =>
                        a.localeCompare(b)
                )
                .map((value) => ({
                    label: value,
                    value: value
                }))
        ];
    }

    get rangeOptions() {

        const total =
            this.totalFloors;

        const ranges = [
            {
                label: 'All',
                start: 1,
                end: total
            }
        ];

        for (
            let start = 1;
            start <= total;
            start += 10
        ) {

            ranges.push({
                label:
                    String(start) +
                    '-' +
                    String(
                        Math.min(
                            start + 9,
                            total
                        )
                    ),

                start: start,

                end:
                    Math.min(
                        start + 9,
                        total
                    )
            });
        }

        return ranges.map((range) => ({

            ...range,

            cssClass:
                this.isRangeSelected(range)
                    ? 'range-button selected'
                    : 'range-button'

        }));
    }

    isRangeSelected(range) {

        return (
            this.selectedRangeStart ===
                range.start &&

            this.selectedRangeEnd ===
                range.end
        );
    }

    get rangeLabel() {

        if (!this.totalFloors) {

            return 'Showing 0 floors';
        }

        return (
            'Showing ' +
            this.selectedRangeStart +
            ' - ' +
            this.selectedRangeEnd +
            ' of ' +
            this.totalFloors +
            ' floors'
        );
    }

    get isAllRangeSelected() {

        return (
            this.selectedRangeStart === 1 &&
            this.selectedRangeEnd ===
                this.totalFloors
        );
    }

    get visibleFloors() {

        const floors =
            this.filteredFloors;

        const start =
            this.selectedRangeStart || 1;

        const end =
            this.selectedRangeEnd ||
            this.totalFloors;

        return floors
            .filter(
                (floor) =>
                    floor.floorIndex >= start &&
                    floor.floorIndex <= end
            )
            .map((floor) => ({

                ...floor,

                units:
                    this.padUnits(
                        floor.units
                    )

            }))
            .reverse();
    }

    get filteredFloors() {

        if (!this.inventory) {

            return [];
        }

        const search =
            this.searchTerm
                .trim()
                .toLowerCase();

        return this.inventory.floors

            .map((floor, index) => {

                const floorMatches =
                    this.floorFilter === 'All' ||
                    this.floorFilter === floor.id;

                if (!floorMatches) {

                    return null;
                }

                let hasMatchingUnit = false;

                const units =
                    floor.units.map(
                        (unit, unitIndex) => {

                            const searchMatches =
                                !search ||

                                (
                                    unit.unitNumber ||
                                    ''
                                )
                                    .toLowerCase()
                                    .includes(search) ||

                                (
                                    unit.unitCode ||
                                    ''
                                )
                                    .toLowerCase()
                                    .includes(search);

                            const configMatches =
                                this.configurationFilter ===
                                    'All' ||

                                unit.configuration ===
                                    this.configurationFilter;

                            const statusMatches =
                                this.availabilityFilter ===
                                    'All' ||

                                unit.flatStatus ===
                                    this.availabilityFilter;

                            const facingMatches =
                                this.facingFilter ===
                                    'All' ||

                                unit.facing ===
                                    this.facingFilter;

                            const viewMatches =
                                this.viewFilter ===
                                    'All' ||

                                unit.view ===
                                    this.viewFilter;

                            const possessionMatches =
                                this.possessionFilter ===
                                    'All' ||

                                unit.possessionStatus ===
                                    this.possessionFilter;

                            const constructionMatches =
                                this.constructionFilter ===
                                    'All' ||

                                unit.constructionStatus ===
                                    this.constructionFilter;

                            const matches =
                                searchMatches &&
                                configMatches &&
                                statusMatches &&
                                facingMatches &&
                                viewMatches &&
                                possessionMatches &&
                                constructionMatches;

                            if (matches) {

                                hasMatchingUnit = true;

                                return unit;
                            }

                            return {
                                id:
                                    'empty-' +
                                    floor.id +
                                    '-' +
                                    unitIndex,

                                isEmpty: true
                            };
                        }
                    );

                if (!hasMatchingUnit) {

                    return null;
                }

                return {
                    ...floor,
                    units,
                    floorIndex: index + 1
                };

            })

            .filter(Boolean);
    }


    get hasFloors() {

        return (
            this.visibleFloors.length > 0
        );
    }

    get hasError() {

        return Boolean(this.error);
    }

    get emptyMessage() {

        return this.inventory
            ? 'No units match the selected filters.'
            : 'No inventory found.';
    }

    get columnCount() {

        const maxUnits =
            this.inventory &&
            this.inventory.maxUnitsPerFloor
                ? this.inventory.maxUnitsPerFloor
                : 1;

        return Math.max(
            maxUnits,
            1
        );
    }

    get matrixGridStyle() {

        return (
            'grid-template-columns: 122px repeat(' +
            this.columnCount +
            ', minmax(80px, 1fr));'
        );
    }

    get unitColumnHeaders() {

        return Array.from(
            {
                length:
                    this.columnCount
            },
            (_, index) => ({

                label:
                    String(
                        index + 1
                    ).padStart(
                        2,
                        '0'
                    ),

                key:
                    index + 1

            })
        );
    }

    get hasMultiplePages() {

        return this.totalFloors > 10;
    }

    handleSearch(event) {

        this.searchTerm =
            event.target.value;
    }

    handleFilterChange(event) {

        const field =
            event.target.dataset.field;

        const value =
            event.detail.value;

        this[field] = value;

        if (
            field === 'floorFilter' &&
            value !== 'All' &&
            this.inventory
        ) {

            const index =
                this.inventory.floors.findIndex(
                    (floor) =>
                        floor.id === value
                );

            if (index >= 0) {

                const start =
                    Math.floor(
                        index / 10
                    ) * 10 + 1;

                this.selectedRangeStart =
                    start;

                this.selectedRangeEnd =
                    Math.min(
                        start + 9,
                        this.totalFloors
                    );
            }
        }
    }

    get moreFiltersIcon() {

        return this.showMoreFilters
            ? 'utility:chevronup'
            : 'utility:chevrondown';
    }

    toggleMoreFilters() {

        this.showMoreFilters =
            !this.showMoreFilters;
    }

    clearFilters() {

        this.searchTerm = '';

        this.configurationFilter =
            'All';

        this.availabilityFilter =
            'All';

        this.facingFilter =
            'All';

        this.viewFilter =
            'All';

        this.floorFilter =
            'All';

        this.possessionFilter =
            'All';

        this.constructionFilter =
            'All';

        this.setInitialRange();
    }

    selectRange(event) {

        const start =
            Number(
                event.currentTarget.dataset.start
            );

        const end =
            Number(
                event.currentTarget.dataset.end
            );

        this.selectedRangeStart =
            start;

        this.selectedRangeEnd =
            end;

        this.floorFilter =
            'All';
    }

    previousRange() {

        if (
            !this.totalFloors ||
            this.selectedRangeStart <= 1
        ) {

            return;
        }

        const start =
            Math.max(
                1,
                this.selectedRangeStart - 10
            );

        const end =
            Math.min(
                this.totalFloors,
                start + 9
            );

        this.selectedRangeStart =
            start;

        this.selectedRangeEnd =
            end;
    }

    nextRange() {

        if (
            !this.totalFloors ||
            this.selectedRangeEnd >=
                this.totalFloors
        ) {

            return;
        }

        const start =
            this.selectedRangeEnd + 1;

        const end =
            Math.min(
                this.totalFloors,
                start + 9
            );

        this.selectedRangeStart =
            start;

        this.selectedRangeEnd =
            end;
    }

    handleFloorJump(event) {

        this.floorJump =
            event.target.value;
    }

    goToFloor() {

        const target =
            Number(this.floorJump);

        if (
            !target ||
            target < 1 ||
            target > this.totalFloors
        ) {

            return;
        }

        const start =
            Math.floor(
                (target - 1) / 10
            ) * 10 + 1;

        this.selectedRangeStart =
            start;

        this.selectedRangeEnd =
            Math.min(
                start + 9,
                this.totalFloors
            );

        this.floorFilter =
            'All';
    }

    padUnits(units) {

        const result = [
            ...units
        ];

        while (
            result.length <
            this.columnCount
        ) {

            result.push({
                id:
                    'empty-' +
                    result.length,

                isEmpty: true
            });
        }

        return result.map(
            (unit, index) => ({

                ...unit,

                key:
                    unit.id ||
                    'empty-' +
                    index,

                cssClass:
                    unit.isEmpty
                        ? 'unit-cell unit-empty'
                        : 'unit-cell ' +
                          this.statusClass(
                              unit.flatStatus
                          )

            })
        );
    }

    statusClass(status) {

        if (
            status ===
            STATUS.AVAILABLE
        ) {

            return 'unit-available';
        }

        if (
            status ===
            STATUS.HOLD
        ) {

            return 'unit-hold';
        }

        if (
            status ===
            STATUS.BOOKED
        ) {

            return 'unit-booked';
        }

        return 'unit-empty';
    }

    reduceError(error) {

        if (
            Array.isArray(
                error &&
                error.body
            )
        ) {

            return error.body
                .map(
                    (e) =>
                        e.message
                )
                .join(', ');
        }

        if (
            error &&
            error.body &&
            error.body.message
        ) {

            return error.body.message;
        }

        if (
            error &&
            error.message
        ) {

            return error.message;
        }

        return 'Unable to load tower inventory.';
    }
    handleUnitClick(event) {

    const unitId =  event.currentTarget.dataset.unitId;
    // Find clicked unit
    const unit = this.inventory?.floors
        ?.flatMap(floor => floor.units)
        ?.find(unit => unit.id === unitId);

    if (!unit) {
        return;
    }

    // ==========================================
    // BOOKED
    // ==========================================

    if (unit.flatStatus === 'Booked') {

        this.showToast(
            'Unit Already Booked',
            'This unit is already booked and cannot be selected.',
            'warning'
        );

        return;
    }


    // ==========================================
    // RESERVED / ON HOLD
    // ==========================================

    if (unit.flatStatus === 'Reserved (On Hold)') {

        this.showToast(
            'Unit On Hold',
            'This unit is currently reserved (on hold) and cannot be selected.',
            'warning'
        );

        return;
    }


    // ==========================================
    // AVAILABLE
    // ==========================================

   if (unit.flatStatus === 'Available') {

    this.selectedUnitId = unit.id;

    const pageReference = {
        type: 'standard__recordPage',
        attributes: {
            recordId: unit.id,
            objectApiName: 'Unit__c',
            actionName: 'view'
        }
    };

    // Add opportunityId only if available
    if (this.opportunityId) {
        pageReference.state = {
            c__opportunityId: this.opportunityId
        };
    }

    this[NavigationMixin.GenerateUrl](pageReference)
    .then((url) => {
        window.open(url, '_blank');
    })
    .catch((error) => {
        console.error('Error generating Unit URL:', error);
    });
}
}
handleUnitModalClose() {

    this.selectedUnitId = null;
}
showToast(title, message, variant) {

    this.dispatchEvent(
        new ShowToastEvent({
            title: title,
            message: message,
            variant: variant,
            mode: 'dismissable'
        })
    );
}
async handleBookSuccess(event) {

    this.showUnitDetails = false;
    this.selectedUnitId = null;

    try {

                refreshApex(this.wiredInventoryResult)
        .then(() => {
        console.log('Data refreshed successfully');
        })
        .catch(error => {
        console.error('Error refreshing data:', error);
        });

        this.showToast(
            'Success',
            'Unit booked successfully.',
            'success'
        );

    } catch (error) {

        this.showToast(
            'Error',
            this.reduceError(error),
            'error'
        );
    }
}
}