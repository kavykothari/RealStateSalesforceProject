public with sharing class TaskDashboardController {

    public class TaskDashboardWrapper {
        @AuraEnabled public List<Task> overdueTasks;
        @AuraEnabled public List<Task> todayTasks;
        @AuraEnabled public List<Task> tomorrowTasks;

        public TaskDashboardWrapper() {
            overdueTasks = new List<Task>();
            todayTasks = new List<Task>();
            tomorrowTasks = new List<Task>();
        }
    }

    /**
     * Returns all open Tasks that are due today, tomorrow,
     * or have a past due date.
     */
    @AuraEnabled(cacheable=false)
    public static TaskDashboardWrapper getTaskDashboard() {

        TaskDashboardWrapper result = new TaskDashboardWrapper();

        Date today = Date.today();
        Date tomorrow = today.addDays(1);

        List<Task> taskList = [
            SELECT
                Id,
                Subject,
                Description,
                ActivityDate,
                Status,
                Priority,
                WhoId,
                Who.Name,
                WhatId,
                What.Name,
                OwnerId,
                Owner.Name,
                CreatedDate
            FROM Task
            WHERE
                Status != 'Completed'
                AND ActivityDate != NULL
                AND ActivityDate <= :tomorrow
            ORDER BY
                ActivityDate ASC,
                CreatedDate DESC
        ];

        for (Task taskRecord : taskList) {

            if (taskRecord.ActivityDate < today) {

                result.overdueTasks.add(taskRecord);

            } else if (taskRecord.ActivityDate == today) {

                result.todayTasks.add(taskRecord);

            } else if (taskRecord.ActivityDate == tomorrow) {

                result.tomorrowTasks.add(taskRecord);
            }
        }

        return result;
    }


    /**
     * Marks a Task as Completed and appends completion
     * comments to the existing Description.
     */
    @AuraEnabled
    public static void completeTask(
        Id taskId,
        String completionComments
    ) {

        if (taskId == null) {
            throw new AuraHandledException(
                'Task Id is required.'
            );
        }

        if (String.isBlank(completionComments)) {
            throw new AuraHandledException(
                'Completion comments are required.'
            );
        }

        Task taskRecord = [
            SELECT
                Id,
                Status,
                Description
            FROM Task
            WHERE Id = :taskId
            LIMIT 1
        ];

        String existingComments = taskRecord.Description;

        String newComment =
            'Completion Comments: ' +
            completionComments.trim();

        if (String.isNotBlank(existingComments)) {

            taskRecord.Description =
                existingComments +
                '\n\n' +
                newComment;

        } else {

            taskRecord.Description = newComment;
        }

        taskRecord.Status = 'Completed';

        update taskRecord;
    }

      public class FollowUpContext {
        @AuraEnabled public String unitId;
        @AuraEnabled public String unitCode;
        @AuraEnabled public String contactId;
        @AuraEnabled public String contactPhone;
        @AuraEnabled public String contactEmail;
    }

    @AuraEnabled
    public static FollowUpContext getFollowUpContext(
        Id unitId,
        Id opportunityId
    ) {
        if (unitId == null) {
            throw new AuraHandledException('Unit record ID is missing.');
        }

        Unit__c unitRecord = [
            SELECT Id, Name
            FROM Unit__c
            WHERE Id = :unitId
            LIMIT 1
        ];

        FollowUpContext result = new FollowUpContext();
        result.unitId = String.valueOf(unitRecord.Id);
        result.unitCode = unitRecord.Name;

        if (opportunityId != null) {
            List<OpportunityContactRole> roles = [
                SELECT ContactId, Contact.Phone, Contact.Email
                FROM OpportunityContactRole
                WHERE OpportunityId = :opportunityId
                AND IsPrimary = true
                LIMIT 1
            ];

            if (!roles.isEmpty()) {
                result.contactId =
                    String.valueOf(roles[0].ContactId);
                result.contactPhone = roles[0].Contact.Phone;
                result.contactEmail = roles[0].Contact.Email;
            }
        }

        return result;
    }

    @AuraEnabled
    public static Id createFollowUpTask(
        Id unitId,
        Id opportunityId,
        Id contactId,
        Date followUpDate,
        String description
    ) {
        if (unitId == null) {
            throw new AuraHandledException('Unit is required.');
        }

        if (followUpDate == null) {
            throw new AuraHandledException(
                'Please select a follow-up date.'
            );
        }

        if (String.isBlank(description)) {
            throw new AuraHandledException(
                'Please enter a description.'
            );
        }

        Task followUpTask = new Task();
        followUpTask.Subject = 'Task / Follow Up';
        followUpTask.ActivityDate = followUpDate;
        followUpTask.Description = description;
        followUpTask.Status = 'Not Started';
        followUpTask.Priority = 'Normal';

        // Link the Task to the Opportunity.
        if (opportunityId != null) {
            followUpTask.WhatId = opportunityId;
        }

        // Link the Task to the Contact, if available.
        if (contactId != null) {
            followUpTask.WhoId = contactId;
        }

        insert followUpTask;

        return followUpTask.Id;
    }
}