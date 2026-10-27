public with sharing class DayEventCalendarController {

    @AuraEnabled(cacheable=false)
    public static List<Event> getEvents(String selectedDate) {

        if (String.isBlank(selectedDate)) {
            throw new AuraHandledException(
                'Selected date is required.'
            );
        }

        Date calendarDate;

        try {
            calendarDate = Date.valueOf(selectedDate);
        } catch (Exception e) {
            throw new AuraHandledException(
                'Invalid date format. Expected YYYY-MM-DD.'
            );
        }

        /*
         * Datetime values are created using the running user's
         * Salesforce timezone.
         */
        Datetime dayStart = Datetime.newInstance(
            calendarDate,
            Time.newInstance(0, 0, 0, 0)
        );

        Datetime dayEnd = dayStart.addDays(1);

        /*
         * Fetch events which overlap the selected day.
         *
         * StartDateTime < dayEnd
         * AND
         * EndDateTime > dayStart
         *
         * This also catches events which started on the
         * previous day and continue into the selected day.
         */
        List<Event> eventList = [
            SELECT
                Id,
                Subject,
                Description,
                StartDateTime,
                EndDateTime,
                ActivityDate,
                IsAllDayEvent,
                Location,
                WhatId,
                What.Name,
                WhoId,
                Who.Name,
                OwnerId,
                Owner.Name,
                CreatedDate,
                LastModifiedDate
            FROM Event
            WHERE
                StartDateTime < :dayEnd
                AND EndDateTime > :dayStart
            ORDER BY
                StartDateTime ASC,
                EndDateTime ASC
        ];

        return eventList;
    }
}