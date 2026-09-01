import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  DescriptionItem,
  DescriptionList,
  ErrorState,
  Field,
  FormGroup,
  KeyboardAwareScreen,
  Radio,
  RadioGroup,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Text,
  Textarea,
  VStack,
  useToast,
} from '@beemvp/beeui-ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as React from 'react';
import { useAsync } from '../../services';
import { useDemoScenario } from '../../state/demo-scenario';
import {
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABEL,
  TICKET_STATUSES,
  TICKET_STATUS_LABEL,
  getTicket,
  saveTicket,
  type Ticket,
  type TicketPriority,
  type TicketStatus,
} from '../records/tickets-data';

const ASSIGNEES = ['Ada Lovelace', 'Alan Turing', 'Grace Hopper'] as const;

type EditableFields = {
  subject: string;
  description: string;
  assignee: string;
  priority: TicketPriority;
  status: TicketStatus;
};

function toEditableFields(ticket: Ticket): EditableFields {
  return {
    subject: ticket.subject,
    description: ticket.description,
    assignee: ticket.assignee,
    priority: ticket.priority,
    status: ticket.status,
  };
}

function isDirty(fields: EditableFields, ticket: Ticket): boolean {
  return (
    fields.subject !== ticket.subject ||
    fields.description !== ticket.description ||
    fields.assignee !== ticket.assignee ||
    fields.priority !== ticket.priority ||
    fields.status !== ticket.status
  );
}

function isTicketPriority(value: string): value is TicketPriority {
  return (TICKET_PRIORITIES as readonly string[]).includes(value);
}

function DetailSkeleton() {
  return (
    <Card className="gap-4" variant="raised">
      <VStack gap="sm">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-24 w-full" />
      </VStack>
    </Card>
  );
}

export function RecordDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { scenario } = useDemoScenario();
  const { data: ticket, error, retry, status } = useAsync(() => getTicket(id, scenario), [id, scenario], {
    isEmpty: (value) => value === null,
  });

  const [editing, setEditing] = React.useState(false);
  const [fields, setFields] = React.useState<EditableFields | null>(null);
  const [subjectError, setSubjectError] = React.useState<string | undefined>();
  const [descriptionError, setDescriptionError] = React.useState<string | undefined>();
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | undefined>();
  const [discardConfirmOpen, setDiscardConfirmOpen] = React.useState(false);

  React.useEffect(() => {
    if (status === 'success' && ticket) setFields(toEditableFields(ticket));
  }, [status, ticket]);

  function startEditing() {
    if (!ticket) return;
    setFields(toEditableFields(ticket));
    setSubjectError(undefined);
    setDescriptionError(undefined);
    setSaveError(undefined);
    setEditing(true);
  }

  function requestExitEditing() {
    if (ticket && fields && isDirty(fields, ticket)) {
      setDiscardConfirmOpen(true);
      return;
    }
    setEditing(false);
  }

  function confirmDiscard() {
    if (ticket) setFields(toEditableFields(ticket));
    setDiscardConfirmOpen(false);
    setEditing(false);
  }

  async function handleSave() {
    if (!ticket || !fields) return;

    const trimmedSubject = fields.subject.trim();
    const trimmedDescription = fields.description.trim();
    const nextSubjectError = trimmedSubject.length === 0 ? 'Subject is required.' : undefined;
    const nextDescriptionError =
      trimmedDescription.length < 10 ? 'Description must be at least 10 characters.' : undefined;
    setSubjectError(nextSubjectError);
    setDescriptionError(nextDescriptionError);
    if (nextSubjectError || nextDescriptionError) return;

    setSaving(true);
    setSaveError(undefined);
    try {
      await saveTicket(ticket.id, { ...fields, subject: trimmedSubject, description: trimmedDescription }, scenario);
      toast.show({ title: 'Ticket saved', description: `${ticket.id} was updated.`, variant: 'success' });
      setEditing(false);
      retry();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Could not save the ticket.';
      setSaveError(message);
      toast.show({ title: 'Save failed', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAwareScreen contentWidth="md">
      <VStack className="py-4" gap="md">
        <Button
          className="self-start px-0"
          onPress={() => (editing ? requestExitEditing() : router.push('/records'))}
          variant="ghost"
        >
          Back to tickets
        </Button>

        {status === 'loading' || status === 'idle' ? (
          <DetailSkeleton />
        ) : status === 'error' ? (
          <Card variant="outlined">
            <ErrorState
              action={<Button onPress={retry}>Try again</Button>}
              description={error.message}
              testID="record-detail-error-state"
            />
          </Card>
        ) : status === 'empty' || !ticket ? (
          <Card variant="outlined">
            <ErrorState
              description={`No ticket was found with id "${id}".`}
              testID="record-detail-not-found"
              title="Ticket not found"
            />
          </Card>
        ) : editing && fields ? (
          <Card className="gap-4" testID="record-detail-edit-form" variant="raised">
            <Text variant="heading">{`Edit ${ticket.id}`}</Text>

            {saveError ? (
              <Text role="alert" tone="destructive" testID="record-detail-save-error" variant="caption">
                {saveError}
              </Text>
            ) : null}

            <Field error={subjectError} invalid={Boolean(subjectError)} label="Subject" required>
              <Textarea
                numberOfLines={2}
                onChangeText={(text) => setFields({ ...fields, subject: text })}
                value={fields.subject}
              />
            </Field>

            <Field error={descriptionError} invalid={Boolean(descriptionError)} label="Description" required>
              <Textarea
                numberOfLines={5}
                onChangeText={(text) => setFields({ ...fields, description: text })}
                value={fields.description}
              />
            </Field>

            <Field label="Assignee">
              <Select onValueChange={(value) => setFields({ ...fields, assignee: value })} value={fields.assignee}>
                <SelectTrigger accessibilityLabel="Assignee">
                  <SelectValue placeholder="Choose an assignee" />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNEES.map((assignee) => (
                    <SelectItem key={assignee} value={assignee}>
                      {assignee}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <FormGroup legend="Priority">
              <RadioGroup
                onValueChange={(value) => {
                  if (isTicketPriority(value)) setFields({ ...fields, priority: value });
                }}
                value={fields.priority}
              >
                {TICKET_PRIORITIES.map((priority) => (
                  <Radio key={priority} label={TICKET_PRIORITY_LABEL[priority]} value={priority} />
                ))}
              </RadioGroup>
            </FormGroup>

            <Field label="Status">
              <Select
                onValueChange={(value) => setFields({ ...fields, status: value as TicketStatus })}
                value={fields.status}
              >
                <SelectTrigger accessibilityLabel="Status">
                  <SelectValue placeholder="Choose a status" />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_STATUSES.map((ticketStatus) => (
                    <SelectItem key={ticketStatus} value={ticketStatus}>
                      {TICKET_STATUS_LABEL[ticketStatus]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <VStack className="flex-row justify-end" gap="sm">
              <Button onPress={requestExitEditing} variant="outline">
                Cancel
              </Button>
              <Button loading={saving} onPress={handleSave}>
                Save changes
              </Button>
            </VStack>

            <AlertDialog onOpenChange={setDiscardConfirmOpen} open={discardConfirmOpen}>
              <AlertDialogContent>
                <AlertDialogTitle>Discard changes?</AlertDialogTitle>
                <AlertDialogDescription>
                  You have unsaved edits to this ticket. Discarding will restore the last saved values.
                </AlertDialogDescription>
                <AlertDialogFooter>
                  <AlertDialogCancel onPress={() => setDiscardConfirmOpen(false)} variant="outline">
                    Keep editing
                  </AlertDialogCancel>
                  <AlertDialogAction onPress={confirmDiscard}>Discard</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </Card>
        ) : (
          <Card className="gap-4" testID="record-detail-view" variant="raised">
            <VStack className="flex-row items-start justify-between" gap="sm">
              <VStack className="flex-1" gap="xs">
                <Text variant="heading">{ticket.subject}</Text>
                <Text tone="subtle" variant="caption">
                  {ticket.id}
                </Text>
              </VStack>
              <Button onPress={startEditing}>Edit</Button>
            </VStack>

            <VStack className="flex-row" gap="sm">
              <Badge variant="secondary">{TICKET_PRIORITY_LABEL[ticket.priority]}</Badge>
              <Badge variant="primary">{TICKET_STATUS_LABEL[ticket.status]}</Badge>
            </VStack>

            <Text variant="body">{ticket.description}</Text>

            <DescriptionList>
              <DescriptionItem label="Requester" value={ticket.requester} />
              <DescriptionItem label="Assignee" value={ticket.assignee} />
              <DescriptionItem label="Last updated" value={ticket.updatedAt} />
            </DescriptionList>
          </Card>
        )}
      </VStack>
    </KeyboardAwareScreen>
  );
}
