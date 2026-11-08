"""Reproduce the catalogue-only desk comparison. No participant data is generated.

Run from any directory: python docs/research/one-page/reproduce.py
Requires Pillow, used only for image measurement and contact-sheet rendering.
No network calls, image retouching, inferred ownership, or recommendation model.
"""

import colorsys
import csv
import hashlib
import itertools
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps, __version__ as pillow_version


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
COLLECTION = ROOT / 'public/collection.json'
DATA = json.loads(COLLECTION.read_text())
CARDS = DATA[1]['cards']
BY_ID = {card['id']: card for card in CARDS}
GROUPS = [
    ['svi-211', 'svi-212', 'svi-245'],
    ['obf-207', 'obf-208', 'obf-225'],
    ['pal-208', 'pal-209', 'pal-210'],
]
SOURCES = json.loads((HERE / 'sources.json').read_text())
PROBES = json.loads((HERE / 'metadata-probes.json').read_text())
PRIMARY = {row['card_id']: row for row in SOURCES['credits']}
API = {
    row['metadata']['id']: row
    for row in PROBES
    if row.get('http_status') == 200 and 'metadata' in row
}
MAPPING = {
    'svi-211': 'sv01-211', 'svi-212': 'sv01-212', 'svi-245': 'sv01-245',
    'obf-207': 'sv03-207', 'obf-208': 'sv03-208', 'obf-225': 'sv03-225',
    'pal-208': 'sv02-208', 'pal-209': 'sv02-209', 'pal-210': 'sv02-210',
}


def save_json(name, value):
    (HERE / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def credit(card):
    return card['facts'].split('gezeichnet von ')[-1]


def image_path(card_id):
    return ROOT / 'public/assets/cards' / (card_id + '.webp')


def hue(card_id):
    with Image.open(image_path(card_id)) as source:
        image = source.convert('RGB')
    width, height = image.size
    area = image.crop((
        int(.06 * width), int(.15 * height),
        int(.94 * width), int(.58 * height),
    )).resize((64, 64), Image.Resampling.BICUBIC)
    raw = area.tobytes()
    x, y, kept = 0.0, 0.0, 0
    for offset in range(0, len(raw), 3):
        h, s, v = colorsys.rgb_to_hsv(*(n / 255 for n in raw[offset:offset + 3]))
        if s < .2 or v < .15 or v > .95:
            continue
        x += s * math.cos(h * 2 * math.pi)
        y += s * math.sin(h * 2 * math.pi)
        kept += 1
    if not kept or math.hypot(x, y) < 1e-9:
        raise ValueError(f'No reliable chromatic hue for {card_id}; do not infer one')
    return math.degrees(math.atan2(y, x)) % 360


assert len(CARDS) == len(BY_ID) == 9
HUES = {card_id: hue(card_id) for card_id in BY_ID}
for card in CARDS:
    source = PRIMARY[card['id']]
    metadata = API[MAPPING[card['id']]]['metadata']
    assert source['http_status'] == 200
    assert f'[{credit(card)}]' in source['evidence_markdown']
    assert metadata['illustrator'] == credit(card)
    assert metadata['name'] == card['name']
    assert f"{metadata['localId']}/{metadata['set']['cardCount']['official']}" == card['number']


def distance(left, right):
    delta = abs(HUES[left] - HUES[right])
    return min(delta, 360 - delta) / 180


def vertical_cost(rows):
    return sum(distance(rows[r][c], rows[r + 1][c]) for r in range(2) for c in range(3))


def flattened(rows):
    return [card_id for row in rows for card_id in row]


row_orders = list(itertools.permutations(GROUPS))
best = min(row_orders, key=lambda rows: (round(vertical_cost(rows), 12), flattened(rows)))
relationship = flattened(best)
artist_grouping = sorted(BY_ID, key=lambda card_id: (credit(BY_ID[card_id]), card_id))
colour_only = sorted(BY_ID, key=lambda card_id: (HUES[card_id], card_id))
artist_only = sorted(card_id for card_id in BY_ID if credit(BY_ID[card_id]) == 'Jiro Sasumo')
artist_only += [None] * (9 - len(artist_only))
assert relationship == artist_grouping, 'If this changes, update the confounding finding.'
PAIRS = [(row[i], row[i + 1]) for row in GROUPS for i in range(2)]


def preserved(layout):
    observed = {(layout[i], layout[i + 1]) for i in range(8) if i % 3 != 2}
    return sum(pair in observed for pair in PAIRS)


layouts = [
    {'id': 'relationship_first', 'slots': relationship},
    {'id': 'artist_only_jiro_sasumo', 'slots': artist_only},
    {'id': 'colour_only', 'slots': colour_only},
]
for layout in layouts:
    layout['filled_pockets'] = sum(card_id is not None for card_id in layout['slots'])
    layout['directed_evolution_adjacencies_of_six'] = preserved(layout['slots'])
    layout['collector_preference'] = None
assert preserved(relationship) == 6
assert preserved(colour_only) == 0
save_json('comparison.json', {
    'status': 'catalogue_image_desk_comparison_not_a_collector_test',
    'ownership_confirmed': False,
    'base_commit': '46a504d758cb0ae5021553031b49b1393868d047',
    'collection_sha256': hashlib.sha256(COLLECTION.read_bytes()).hexdigest(),
    'pillow_version': pillow_version,
    'required_pairs_for_this_desk_probe_only': PAIRS,
    'image_measurements': {
        card_id: {
            'hue_degrees': value,
            'sha256': hashlib.sha256(image_path(card_id).read_bytes()).hexdigest(),
        }
        for card_id, value in HUES.items()
    },
    'evaluated_row_orders': [
        {'slots': flattened(rows), 'vertical_hue_cost': vertical_cost(rows)}
        for rows in row_orders
    ],
    'layouts': layouts,
    'artist_grouping_control_slots': artist_grouping,
    'artist_grouping_equals_relationship': relationship == artist_grouping,
    'original_editorial_slots': [card['id'] for card in CARDS],
    'blind_selections': None,
    'physical_assembly': None,
    'retention_day_7': None,
    'unseen_cards_check': 'not_run',
})

with (HERE / 'inventory-audit.csv').open('w', newline='') as output:
    fields = [
        'repo_card_id', 'tcgdex_id', 'name', 'set', 'printed_number_in_repo_image',
        'language_visible_in_repo_image', 'illustrator', 'publisher_source',
        'publisher_web_number_conflict', 'original_collector_photo',
        'exact_owned_print_confirmed', 'confirmed_quantity', 'available_quantity',
        'recognition_test_status',
    ]
    writer = csv.DictWriter(output, fieldnames=fields, lineterminator='\n')
    writer.writeheader()
    for card in CARDS:
        card_id = card['id']
        writer.writerow({
            'repo_card_id': card_id, 'tcgdex_id': MAPPING[card_id],
            'name': card['name'], 'set': card['set'],
            'printed_number_in_repo_image': card['number'],
            'language_visible_in_repo_image': 'de', 'illustrator': credit(card),
            'publisher_source': PRIMARY[card_id]['url'],
            'publisher_web_number_conflict': 'denominator_227_vs_printed_197' if card_id.startswith('obf-') else '',
            'original_collector_photo': '', 'exact_owned_print_confirmed': 'not_collected',
            'confirmed_quantity': '', 'available_quantity': '',
            'recognition_test_status': 'not_run_no_original_photos',
        })

sheet = Image.new('RGB', (2028, 1114), '#ece8df')
draw = ImageDraw.Draw(sheet)
heading = ImageFont.load_default(size=22)
label = ImageFont.load_default(size=15)
small = ImageFont.load_default(size=13)
draw.text((16, 10), 'CATALOGUE IMAGE PROBE - no collector inventory or preference results', fill='#222222', font=heading)
titles = [
    ('Relationship first', 'Same output as artist grouping; 6/6 directed pairs'),
    ('Artist only: Jiro Sasumo', '3 cards available in this example; 6 empty pockets'),
    ('Colour only: ascending measured hue', '0/6 directed pairs; aesthetic preference unknown'),
]
for board, (layout, (title, note)) in enumerate(zip(layouts, titles)):
    left = 16 + board * 676
    draw.text((left, 48), title, fill='#222222', font=heading)
    draw.text((left, 78), note, fill='#333333', font=small)
    for pocket, card_id in enumerate(layout['slots']):
        x = left + (pocket % 3) * 216
        y = 106 + (pocket // 3) * 326
        draw.rectangle((x, y, x + 208, y + 292), fill='#313335')
        if card_id is None:
            draw.text((x + 16, y + 130), f'Pocket {pocket + 1}: empty', fill='#eeeeee', font=label)
            continue
        with Image.open(image_path(card_id)) as card_image:
            thumbnail = ImageOps.contain(card_image.convert('RGB'), (204, 288))
        sheet.paste(thumbnail, (x + (208 - thumbnail.width) // 2, y + (292 - thumbnail.height) // 2))
        draw.text((x, y + 297), f'{pocket + 1}: {card_id}', fill='#222222', font=label)
draw.text((16, 1090), 'Complete card images, equal scale. Artist shortage is a feasibility result, not a blind preference defeat.', fill='#222222', font=label)
sheet.save(HERE / 'comparison.png', optimize=True)
print('Reproduced 3 image boards; verified 9 credits and metadata mappings; generated no participant results.')
