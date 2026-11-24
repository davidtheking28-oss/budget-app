import plistlib, sys, uuid

URL = 'https://fnklrqxwyeibfptaxewf.supabase.co/functions/v1/apple-pay-ingest'
PATH = 'shekel-shekel/code.txt'
OBJ = '\ufffc'


def uid():
    return str(uuid.uuid4()).upper()


def token_string(text, attachments=None):
    value = {'string': text}
    if attachments:
        value['attachmentsByRange'] = attachments
    return {'Value': value, 'WFSerializationType': 'WFTextTokenString'}


def var_string(var):
    return token_string(OBJ, {'{0, 1}': var})


def attachment(var):
    return {'Value': var, 'WFSerializationType': 'WFTextTokenAttachment'}


def action(name, **params):
    return {'WFWorkflowActionIdentifier': 'is.workflow.actions.' + name, 'WFWorkflowActionParameters': params}


def output(u, name):
    return {'OutputUUID': u, 'Type': 'ActionOutput', 'OutputName': name}


def trigger(prop):
    return {'TriggerIdentifier': 'WFWalletTransactionTrigger', 'Type': 'TriggerOutput',
            'Aggrandizements': [{'Type': 'WFPropertyVariableAggrandizement', 'PropertyName': prop}]}


def field(key, value):
    return {'WFItemType': 0, 'WFKey': token_string(key), 'WFValue': value}


def dictionary(*items):
    return {'Value': {'WFDictionaryFieldValueItems': list(items)}, 'WFSerializationType': 'WFDictionaryFieldValue'}


text_in, matched, group, opened, code = uid(), uid(), uid(), uid(), uid()
actions = [
    action('gettext', UUID=text_in, WFTextActionText=var_string({'Type': 'ExtensionInput'})),
    action('text.match', UUID=matched, WFMatchTextPattern='^ab1_[0-9a-f]{64}$', WFMatchTextCaseSensitive=True,
           text=var_string(output(text_in, 'Text'))),
    action('conditional', GroupingIdentifier=group, WFControlFlowMode=0, WFCondition=100,
           WFInput={'Type': 'Variable', 'Variable': attachment(output(matched, 'Matches'))}),
    action('alert', WFAlertActionTitle='שקל שקל', WFAlertActionMessage='לחבר את הקיצור לחשבון שלך? אשר רק אם לחצת עכשיו על "חבר" באפליקציה.',
           WFAlertActionCancelButtonShown=True),
    action('documentpicker.save', WFInput=attachment(output(text_in, 'Text')), WFAskWhereToSave=False,
           WFFileDestinationPath=PATH, WFSaveFileOverwrite=True),
    action('notification', WFNotificationActionTitle='שקל שקל', WFNotificationActionBody='✓ הקיצור חובר לחשבון'),
    action('conditional', GroupingIdentifier=group, WFControlFlowMode=1),
    action('documentpicker.open', UUID=opened, WFGetFilePath=PATH, WFShowFilePicker=False, WFFileErrorIfNotFound=True),
    action('detect.text', UUID=code, WFInput=attachment(output(opened, 'File'))),
    action('downloadurl', UUID=uid(), WFURL=URL, WFHTTPMethod='POST', ShowHeaders=True,
           WFHTTPHeaders=dictionary(field('X-Budget-Token', var_string(output(code, 'Text')))),
           WFHTTPBodyType='JSON',
           WFJSONValues=dictionary(field('merchant', var_string(trigger('Merchant'))), field('amount', var_string(trigger('Amount'))))),
    action('conditional', GroupingIdentifier=group, WFControlFlowMode=2, UUID=uid()),
]
workflow = {
    'WFWorkflowMinimumClientVersionString': '900',
    'WFWorkflowMinimumClientVersion': 900,
    'WFWorkflowClientVersion': '5114.0.8.3',
    'WFWorkflowIcon': {'WFWorkflowIconStartColor': -20702977, 'WFWorkflowIconGlyphNumber': 61440},
    'WFWorkflowHasShortcutInputVariables': True,
    'WFWorkflowHasOutputFallback': False,
    'WFWorkflowInputContentItemClasses': ['WFStringContentItem'],
    'WFWorkflowOutputContentItemClasses': [],
    'WFWorkflowImportQuestions': [],
    'WFWorkflowTypes': ['WFWorkflowTypeShowInSearch'],
    'WFQuickActionSurfaces': [],
    'WFWorkflowTriggers': [{'WFTriggerIdentifier': 'WFWalletTransactionTrigger', 'WFTriggerUUID': uid(), 'WFTriggerSerializedParameters': {}}],
    'WFWorkflowActions': actions,
}
with open(sys.argv[1], 'wb') as f:
    plistlib.dump(workflow, f, fmt=plistlib.FMT_BINARY)
