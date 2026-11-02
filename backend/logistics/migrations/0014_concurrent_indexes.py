from django.db import migrations, models

class ConcurrentIndexOp(migrations.operations.base.Operation):
    def __init__(self, model_name, index):
        self.model_name = model_name
        self.index = index

    def state_forwards(self, app_label, state):
        state.add_index(app_label, self.model_name, self.index)

    def database_forwards(self, app_label, schema_editor, from_state, to_state):
        model = to_state.apps.get_model(app_label, self.model_name)
        table = model._meta.db_table
        idx_name = self.index.name
        cols = []
        for f in self.index.fields:
            if f.startswith('-'):
                col_name = f[1:] + ('_id' if f[1:] in ('driver', 'order', 'shipment') else '')
                cols.append(f'"{col_name}" DESC')
            else:
                col_name = f + ('_id' if f in ('driver', 'order', 'shipment') else '')
                cols.append(f'"{col_name}" ASC')
        cols_sql = ', '.join(cols)

        if schema_editor.connection.vendor == 'postgresql':
            schema_editor.execute(f'CREATE INDEX CONCURRENTLY IF NOT EXISTS "{idx_name}" ON "{table}" ({cols_sql})')
        else:
            schema_editor.execute(f'CREATE INDEX IF NOT EXISTS "{idx_name}" ON "{table}" ({cols_sql})')

    def database_backwards(self, app_label, schema_editor, from_state, to_state):
        idx_name = self.index.name
        if schema_editor.connection.vendor == 'postgresql':
            schema_editor.execute(f'DROP INDEX CONCURRENTLY IF EXISTS "{idx_name}"')
        else:
            schema_editor.execute(f'DROP INDEX IF EXISTS "{idx_name}"')

    def describe(self):
        return f"Concurrently create index {self.index.name} on {self.model_name}"


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('logistics', '0013_alter_shipment_options_and_more'),
    ]

    operations = [
        ConcurrentIndexOp(
            model_name='driverpayment',
            index=models.Index(fields=['driver', 'is_paid'], name='log_driver_pay_idx'),
        ),
        ConcurrentIndexOp(
            model_name='pickupcode',
            index=models.Index(fields=['order', 'is_used'], name='log_pickup_order_used_idx'),
        ),
    ]
