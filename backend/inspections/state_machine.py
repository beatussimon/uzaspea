class StateMachineException(Exception):
    pass

class InspectionStateMachine:
    STATUSES = {
        'requested': 'Requested',
        'bill_sent': 'Bill Sent',
        'awaiting_payment': 'Awaiting Payment',
        'deposit_paid': 'Deposit Paid',
        'pre_inspection': 'Pre-Inspection',
        'assigned': 'Assigned',
        'in_progress': 'In Progress',
        'submitted': 'Submitted',
        'qa_review': 'QA Review',
        'published': 'Published',
        'cancelled': 'Cancelled',
        'blocked': 'Blocked',
        'rescheduled': 'Rescheduled',
    }

    # Strict transition rules
    VALID_TRANSITIONS = {
        'requested': {'bill_sent', 'cancelled', 'blocked'},
        'bill_sent': {'awaiting_payment', 'cancelled', 'blocked'},
        'awaiting_payment': {'deposit_paid', 'cancelled', 'blocked'},
        'deposit_paid': {'pre_inspection', 'assigned', 'cancelled', 'blocked'},
        'pre_inspection': {'assigned', 'cancelled', 'blocked', 'rescheduled'},
        'assigned': {'in_progress', 'rescheduled', 'cancelled', 'blocked'},
        'in_progress': {'submitted', 'rescheduled', 'blocked'},
        'submitted': {'qa_review', 'blocked'},
        'qa_review': {'published', 'in_progress', 'blocked'},
        'published': {'blocked'},
        'cancelled': set(),
        'blocked': {
            'requested', 'bill_sent', 'awaiting_payment', 'deposit_paid',
            'pre_inspection', 'assigned', 'in_progress', 'submitted',
            'qa_review', 'published', 'rescheduled'
        },
        'rescheduled': {'assigned', 'in_progress', 'cancelled', 'blocked'},
    }

    @classmethod
    def can_transition(cls, current_status, new_status):
        if current_status not in cls.VALID_TRANSITIONS:
            return False
        return new_status in cls.VALID_TRANSITIONS[current_status]

    @classmethod
    def validate_transition(cls, request_obj, new_status, user):
        """
        Validates transition from current status of request_obj to new_status.
        Raises StateMachineException if invalid.
        """
        current_status = request_obj.status

        # If it is the same state, it is a no-op
        if current_status == new_status:
            return

        # Superuser bypasses transition checks, but must still be a valid state
        if user.is_superuser:
            if new_status not in cls.STATUSES:
                raise StateMachineException(f"Invalid destination status: '{new_status}'")
            return

        # General transition validation
        if not cls.can_transition(current_status, new_status):
            raise StateMachineException(
                f"Transition from '{current_status}' to '{new_status}' is illegal."
            )

        # Role-based validation
        is_staff = user.is_staff or getattr(user, 'is_staff_profile_active', False)
        is_inspector = getattr(user, 'is_inspector_profile_active', False) or hasattr(user, 'inspector_profile')
        is_client = (request_obj.client == user)

        # 1. Transitions only staff can make
        if new_status in {'bill_sent', 'deposit_paid', 'qa_review', 'published', 'blocked'}:
            if not is_staff:
                raise StateMachineException(f"Only staff can transition requests to '{new_status}'.")

        # 2. Client transitions (cancellation, etc.)
        if new_status == 'cancelled':
            # Client can only cancel before work has started (before assigned / in_progress)
            if is_client and current_status not in {'requested', 'bill_sent', 'awaiting_payment'}:
                raise StateMachineException("Client cannot cancel an inspection after assignment or execution has begun.")
            if not (is_client or is_staff):
                raise StateMachineException("Only client or staff can cancel an inspection.")

        # 3. Inspector transitions
        if new_status in {'in_progress', 'submitted', 'rescheduled'}:
            # Verify if user is the assigned inspector
            active_assignment = request_obj.active_assignment
            assigned_user = active_assignment.inspector.user if active_assignment else None
            
            if not is_staff:
                if not (is_inspector and assigned_user == user):
                    raise StateMachineException(
                        f"Only the assigned inspector can transition request to '{new_status}'."
                    )
