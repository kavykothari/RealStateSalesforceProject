import { LightningElement, track } from 'lwc';

import getEvents
    from '@salesforce/apex/DayEventCalendarController.getEvents';

import { ShowToastEvent }
    from 'lightning/platformShowToastEvent';


export default class DayEventCalendar extends LightningElement {

    // =========================================================
    // DATA
    // =========================================================

    @track events = [];

    @track selectedEvent = null;


    // =========================================================
    // DATE
    // =========================================================

    selectedDate = '';

    displayDate = '';

    currentDateLabel = '';

    currentDayLabel = '';


    // =========================================================
    // UI STATE
    // =========================================================

    showEventModal = false;

    isLoading = false;


    // =========================================================
    // CONSTANTS
    // =========================================================

    HOUR_HEIGHT = 60;


    // =========================================================
    // LIFECYCLE
    // =========================================================

    connectedCallback() {

        const today = new Date();

        this.selectedDate =
            this.toDateString(today);

        this.updateDateLabels();

        this.loadEvents();
    }


    // =========================================================
    // GETTERS
    // =========================================================

    get hasEvents() {
        return this.events.length > 0;
    }


    get allDayEvents() {

        return this.events.filter(
            event => event.IsAllDayEvent
        );
    }


    get timedEvents() {

        return this.events.filter(
            event => !event.IsAllDayEvent
        );
    }


    get hasAllDayEvents() {

        return this.allDayEvents.length > 0;
    }


    get hasTimedEvents() {

        return this.timedEvents.length > 0;
    }


    // =========================================================
    // HOURS
    // =========================================================

    get hours() {

        return Array.from(
            { length: 24 },
            (_, index) => {

                const hour =
                    index.toString().padStart(2, '0');

                return {
                    value: index,
                    label: this.formatHour(index),
                    key: `hour-${index}`
                };
            }
        );
    }


    // =========================================================
    // FORMAT HOUR
    // =========================================================

    formatHour(hour) {

        if (hour === 0) {
            return '12 AM';
        }

        if (hour === 12) {
            return '12 PM';
        }

        if (hour > 12) {
            return `${hour - 12} PM`;
        }

        return `${hour} AM`;
    }


    // =========================================================
    // LOAD EVENTS
    // =========================================================

    async loadEvents() {

        this.isLoading = true;

        try {

            const result =
                await getEvents({
                    selectedDate: this.selectedDate
                });

            this.events =
                this.prepareEvents(
                    result || []
                );

            console.log(
                'Events:',
                this.events
            );

        } catch (error) {

            console.error(
                'Calendar Error:',
                error
            );

            this.events = [];

            this.showToast(
                'Error',
                this.getErrorMessage(error),
                'error'
            );

        } finally {

            this.isLoading = false;
        }
    }


    // =========================================================
    // PREPARE EVENTS
    // =========================================================

    prepareEvents(eventList) {

    return eventList.map(event => {

        const prepared = {
            ...event,

            eventUrl: `/${event.Id}`,

            nameValue:
                event.Who?.Name ||
                'Not specified',

            nameUrl:
                event.WhoId
                    ? `/${event.WhoId}`
                    : null,

            relatedToName:
                event.What?.Name ||
                'Not specified',

            relatedToUrl:
                event.WhatId
                    ? `/${event.WhatId}`
                    : null,

            ownerName:
                event.Owner?.Name ||
                'Unknown',

            formattedStart:
                this.formatDateTime(
                    event.StartDateTime
                ),

            formattedEnd:
                this.formatDateTime(
                    event.EndDateTime
                ),

            formattedEventDate:
                this.formatEventDate(
                    event.StartDateTime
                ),

            eventClass:
                event.IsAllDayEvent
                    ? 'calendar-event all-day-event'
                    : 'calendar-event'
        };

        if (!event.IsAllDayEvent) {

            prepared.style =
                this.calculateEventStyle(
                    event
                );
        }

        return prepared;
    });
}


    // =========================================================
    // CALCULATE EVENT POSITION
    // =========================================================

    calculateEventStyle(event) {
    if (!event.StartDateTime || !event.EndDateTime) {
        return '';
    }

    const startDate = new Date(event.StartDateTime);
    const endDate = new Date(event.EndDateTime);

    /*
     * Get start time as minutes from midnight.
     * Example:
     * 10:00 AM = 600 minutes
     * 1:30 PM  = 810 minutes
     */
    const startMinutes =
        startDate.getHours() * 60 +
        startDate.getMinutes();

    const endMinutes =
        endDate.getHours() * 60 +
        endDate.getMinutes();

    /*
     * Handle events which cross midnight.
     */
    let durationMinutes =
        endMinutes - startMinutes;

    if (durationMinutes <= 0) {
        durationMinutes = 30;
    }

    /*
     * 60px = 1 hour
     * Therefore:
     *
     * 10:00 AM
     * = 10 * 60 = 600 minutes
     * = 600px from top
     */
    const top =
        (startMinutes / 60) *
        this.HOUR_HEIGHT;

    /*
     * Minimum height of 30 minutes.
     */
    const height =
        Math.max(
            (durationMinutes / 60) *
            this.HOUR_HEIGHT,
            30
        );

    return `
        top: ${top}px;
        height: ${height}px;
    `;
}


    // =========================================================
    // DATE NAVIGATION
    // =========================================================

    handlePreviousDay() {

        const date =
            this.parseDateLocal(
                this.selectedDate
            );

        date.setDate(
            date.getDate() - 1
        );

        this.selectedDate =
            this.toDateString(date);

        this.updateDateLabels();

        this.loadEvents();
    }


    handleNextDay() {

        const date =
            this.parseDateLocal(
                this.selectedDate
            );

        date.setDate(
            date.getDate() + 1
        );

        this.selectedDate =
            this.toDateString(date);

        this.updateDateLabels();

        this.loadEvents();
    }


    handleToday() {

        const today =
            new Date();

        this.selectedDate =
            this.toDateString(today);

        this.updateDateLabels();

        this.loadEvents();
    }


    handleDateChange(event) {

        const value =
            event.target.value;

        if (!value) {
            return;
        }

        this.selectedDate = value;

        this.updateDateLabels();

        this.loadEvents();
    }


    // =========================================================
    // UPDATE DATE LABELS
    // =========================================================

    updateDateLabels() {

        const date =
            this.parseDateLocal(
                this.selectedDate
            );


        this.currentDayLabel =
            new Intl.DateTimeFormat(
                'en-US',
                {
                    weekday: 'short'
                }
            ).format(date).toUpperCase();


        this.currentDateLabel =
            new Intl.DateTimeFormat(
                'en-US',
                {
                    day: '2-digit'
                }
            ).format(date);


        this.displayDate =
            new Intl.DateTimeFormat(
                'en-IN',
                {
                    weekday: 'long',
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                }
            ).format(date);
    }


    // =========================================================
    // EVENT CLICK
    // =========================================================

    handleEventClick(event) {

        event.stopPropagation();

        const eventId =
            event.currentTarget.dataset.id;

        const selected =
            this.events.find(
                item => item.Id === eventId
            );

        if (!selected) {
            return;
        }

        this.selectedEvent = selected;

        this.showEventModal = true;
    }


    // =========================================================
    // CLOSE MODAL
    // =========================================================

    closeEventModal() {

        this.showEventModal = false;

        this.selectedEvent = null;
    }


    // =========================================================
    // DATE HELPERS
    // =========================================================

    toDateString(date) {

        const year =
            date.getFullYear();

        const month =
            String(
                date.getMonth() + 1
            ).padStart(2, '0');

        const day =
            String(
                date.getDate()
            ).padStart(2, '0');

        return `${year}-${month}-${day}`;
    }


    parseDateLocal(dateString) {

        const [
            year,
            month,
            day
        ] = dateString
            .split('-')
            .map(Number);

        return new Date(
            year,
            month - 1,
            day
        );
    }


    // =========================================================
    // DATE TIME FORMAT
    // =========================================================

    formatDateTime(dateValue) {

        if (!dateValue) {
            return 'N/A';
        }

        try {

            return new Intl.DateTimeFormat(
                'en-IN',
                {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                }
            ).format(
                new Date(dateValue)
            );

        } catch (error) {

            return dateValue;
        }
    }


    formatEventDate(dateValue) {

        if (!dateValue) {
            return 'N/A';
        }

        try {

            return new Intl.DateTimeFormat(
                'en-IN',
                {
                    weekday: 'short',
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                }
            ).format(
                new Date(dateValue)
            );

        } catch (error) {

            return dateValue;
        }
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


    // =========================================================
    // ERROR
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

    handleOpenEvent() {

    if (!this.selectedEvent) {
        return;
    }

    window.open(
        this.selectedEvent.eventUrl,
        '_blank'
    );
}

}