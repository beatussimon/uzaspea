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
                col_name = f[1:] + ('_id' if f[1:] in ('seller', 'user', 'order', 'product') else '')
                cols.append(f'"{col_name}" DESC')
            else:
                col_name = f + ('_id' if f in ('seller', 'user', 'order', 'product') else '')
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
        ('marketplace', '0122_geofencesettings'),
    ]

    operations = [
        ConcurrentIndexOp(
            model_name='product',
            index=models.Index(fields=['seller', 'is_available'], name='mkt_prod_seller_avail_idx'),
        ),
        ConcurrentIndexOp(
            model_name='order',
            index=models.Index(fields=['user', '-order_date'], name='mkt_order_user_date_idx'),
        ),
        ConcurrentIndexOp(
            model_name='orderitem',
            index=models.Index(fields=['order', 'product'], name='mkt_item_order_prod_idx'),
        ),
    ]
