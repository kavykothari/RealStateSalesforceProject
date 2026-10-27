public with sharing class CaseEmailAgentAction {

    public class Request {
        @InvocableVariable(required=true)
        public Id caseId;

        @InvocableVariable(required=true)
        public String emailType;

        /*@InvocableVariable
        public String originalMessageId;*/ //R
    }

    public class Result {
        @InvocableVariable
        public String message;
    }

    @InvocableMethod(
        label='Send Case Email'
        description='Send a Case acknowledgement or resolution email. For a resolution reply, provide the Message-ID of the original acknowledgement email.'
    )
    public static List<Result> sendEmail(List<Request> requests) {
        List<Result> results = new List<Result>();

        for (Request req : requests) {
            Result res = new Result();

            try {
               
                Case c = [
                    SELECT Id, CaseNumber, SuppliedEmail
                    FROM Case
                    WHERE Id = :req.caseId
                    LIMIT 1
                ];
                
                String threadingToken = EmailMessages.getFormattedThreadingToken(c.Id);

                if (String.isBlank(c.SuppliedEmail)) {
                    throw new EmailException(
                        'The Case has no Supplied Email address.'
                    );
                }

                Boolean isResolution =
                    req.emailType != null &&
                    req.emailType.equalsIgnoreCase('RESOLUTION');

                Messaging.SingleEmailMessage mail =
                    new Messaging.SingleEmailMessage();

                mail.setToAddresses(
                    new String[] { c.SuppliedEmail }
                );

                if (isResolution) {
                    /*if (String.isBlank(req.originalMessageId)) {
                        throw new EmailException(
                            'Provide the original email Message-ID.' //R
                        );
                    }*/

                    mail.setSubject(
                        'Support Request Case - ' + c.CaseNumber
                    );

                    mail.setPlainTextBody(
                        'Your support request has been resolved. ' +
                        'Case Number: ' + c.CaseNumber +
                        '\n\n' + threadingToken
                    );
                    
                    /*mail.setPlainTextBody(
                        'Support Request - ' +
                        'Case Number: ' + c.CaseNumber +
                        '\n\n' + threadingToken
                    );*/

                    //mail.setInReplyTo(req.originalMessageId); //R
                    //mail.setReferences(req.originalMessageId);//R

                } else {
                    /*mail.setSubject(
                        'Case ' + c.CaseNumber + ' - Received'
                    );*/
                    
                     mail.setSubject(
                        'Support Request Case - ' + c.CaseNumber
                    );

                    mail.setPlainTextBody(
                        'We have received your support request. ' +
                        'Case Number: ' + c.CaseNumber +
                        '\n\n' + threadingToken
                    );
                    /*mail.setPlainTextBody(
                        'Support Request - ' +
                        'Case Number: ' + c.CaseNumber +
                        '\n\n' + threadingToken
                    );*/
                }

                Messaging.SendEmailResult[] sendResults =
                    Messaging.sendEmail(
                        new Messaging.SingleEmailMessage[] { mail }
                    );

                if (sendResults[0].isSuccess()) {
                    res.message = 'Email sent successfully.';
                } else {
                    res.message =
                        'Email failed: ' +
                        sendResults[0].getErrors()[0].getMessage();
                }

            } catch (Exception e) {
                res.message = 'Error: ' + e.getMessage();
            }

            results.add(res);
        }

        return results;
    }

    public class EmailException extends Exception {}
}