import csv

tz_cars = {
    'Toyota': {
        'IST': {'years': range(2005, 2017), 'trims': [('1.3F', '1.3L 2NZ-FE'), ('1.5G', '1.5L 1NZ-FE')]},
        'Vitz': {'years': range(2005, 2021), 'trims': [('F', '1.0L 1KR-FE'), ('U', '1.3L 1NR-FE'), ('RS', '1.5L 1NZ-FE')]},
        'Crown': {'years': range(2005, 2023), 'trims': [('Athlete', '2.5L 4GR-FSE V6'), ('Royal Saloon', '2.5L V6'), ('Majesta', '4.6L 1UR-FSE V8')]},
        'Harrier': {'years': range(2005, 2023), 'trims': [('240G', '2.4L 2AZ-FE'), ('350G', '3.5L 2GR-FE V6'), ('Premium', '2.0L 3ZR-FAE'), ('Hybrid', '2.5L 2AR-FXE')]},
        'Land Cruiser Prado': {'years': range(2005, 2024), 'trims': [('TX', '2.7L 2TR-FE'), ('TXL', '2.7L 2TR-FE'), ('TZ', '4.0L 1GR-FE V6'), ('TX Diesel', '3.0L 1KD-FTV')]},
        'Land Cruiser V8': {'years': range(2008, 2022), 'trims': [('AX', '4.6L 1UR-FE V8'), ('ZX', '4.6L V8'), ('GX Diesel', '4.5L 1VD-FTV V8')]},
        'Hilux': {'years': range(2005, 2024), 'trims': [('Single Cab', '2.5L Diesel'), ('Double Cab SR5', '3.0L Diesel'), ('Invincible', '2.8L Diesel')]},
        'Alphard': {'years': range(2005, 2024), 'trims': [('240G', '2.4L'), ('350G', '3.5L V6'), ('Executive Lounge', '3.5L V6')]},
        'Noah': {'years': range(2005, 2022), 'trims': [('X', '2.0L 3ZR-FAE'), ('S', '2.0L'), ('G', '2.0L')]},
        'Voxy': {'years': range(2005, 2022), 'trims': [('Z', '2.0L 3ZR-FAE'), ('ZS', '2.0L'), ('Hybrid V', '1.8L Hybrid')]},
        'Vanguard': {'years': range(2007, 2014), 'trims': [('240S', '2.4L 2AZ-FE'), ('350S', '3.5L V6')]},
        'RAV4': {'years': range(2005, 2024), 'trims': [('XLE', '2.0L'), ('Adventure', '2.5L'), ('Hybrid', '2.5L Hybrid')]},
        'Passo': {'years': range(2005, 2021), 'trims': [('X', '1.0L 1KR-FE'), ('G', '1.3L K3-VE')]},
        'Probox': {'years': range(2005, 2021), 'trims': [('DX', '1.3L'), ('GL', '1.5L 1NZ-FE')]},
        'Succeed': {'years': range(2005, 2021), 'trims': [('TX', '1.5L 1NZ-FE'), ('UL', '1.5L 1NZ-FE')]},
        'Hiace': {'years': range(2005, 2024), 'trims': [('DX', '3.0L Diesel 1KD'), ('Super GL', '3.0L Diesel')]},
        'Coaster': {'years': range(2005, 2024), 'trims': [('EX', '4.0L Diesel 1W'), ('LX', '4.0L Diesel')]},
        'Mark X': {'years': range(2005, 2020), 'trims': [('250G', '2.5L 4GR-FSE V6'), ('300G', '3.0L V6')]},
        'Brevis': {'years': range(2005, 2008), 'trims': [('Ai250', '2.5L 1JZ-FSE'), ('Ai300', '3.0L 2JZ-FSE')]},
        'Premio': {'years': range(2005, 2022), 'trims': [('F', '1.5L 1NZ-FE'), ('X', '1.8L 2ZR-FE'), ('G', '2.0L 3ZR-FAE')]},
        'Allion': {'years': range(2005, 2022), 'trims': [('A15', '1.5L 1NZ-FE'), ('A18', '1.8L 2ZR-FE'), ('A20', '2.0L 3ZR-FAE')]},
        'Corolla Fielder': {'years': range(2005, 2022), 'trims': [('X', '1.5L 1NZ-FE'), ('S', '1.8L 2ZR-FE')]},
        'Corolla Axio': {'years': range(2007, 2022), 'trims': [('X', '1.5L 1NZ-FE'), ('G', '1.5L 1NZ-FE')]},
        'Auris': {'years': range(2007, 2019), 'trims': [('150X', '1.5L 1NZ-FE'), ('180G', '1.8L 2ZR-FE')]},
        'Aqua': {'years': range(2012, 2024), 'trims': [('L', '1.5L 1NZ-FXE Hybrid'), ('S', '1.5L Hybrid'), ('G', '1.5L Hybrid')]},
    },
    'Nissan': {
        'Dualis': {'years': range(2007, 2015), 'trims': [('20G', '2.0L MR20DE'), ('20S', '2.0L MR20DE')]},
        'X-Trail': {'years': range(2005, 2024), 'trims': [('20X', '2.0L MR20DD'), ('20Xt', '2.0L'), ('Hybrid', '2.0L Hybrid')]},
        'Note': {'years': range(2005, 2024), 'trims': [('15X', '1.5L HR15DE'), ('e-POWER', '1.2L Hybrid')]},
        'Tiida': {'years': range(2005, 2019), 'trims': [('15M', '1.5L HR15DE'), ('18G', '1.8L MR18DE')]},
        'Juke': {'years': range(2010, 2024), 'trims': [('15RX', '1.5L HR15DE'), ('16GT', '1.6L Turbo')]},
        'Patrol': {'years': range(2005, 2024), 'trims': [('GL', '4.8L V6'), ('LE', '5.6L V8'), ('Safari', '4.2L Diesel')]},
        'Hardbody': {'years': range(2005, 2021), 'trims': [('NP300', '2.5L Diesel')]},
        'Navara': {'years': range(2008, 2024), 'trims': [('LE', '2.5L Diesel'), ('PRO-4X', '2.5L Diesel')]},
        'Bluebird Sylphy': {'years': range(2005, 2019), 'trims': [('20G', '2.0L MR20DE'), ('15S', '1.5L HR15DE')]},
        'Fuga': {'years': range(2005, 2021), 'trims': [('250GT', '2.5L V6'), ('350GT', '3.5L V6')]},
        'Serena': {'years': range(2005, 2024), 'trims': [('Highway Star', '2.0L MR20DD'), ('e-POWER', '1.2L Hybrid')]},
        'March': {'years': range(2005, 2023), 'trims': [('12S', '1.2L HR12DE'), ('12X', '1.2L HR12DE')]},
    },
    'Subaru': {
        'Forester': {'years': range(2005, 2024), 'trims': [('2.0i', '2.0L FB20'), ('2.0XT', '2.0L Turbo FA20'), ('X-Break', '2.5L FB25')]},
        'Impreza': {'years': range(2005, 2023), 'trims': [('1.5i', '1.5L EL15'), ('2.0i-S', '2.0L FB20'), ('WRX STI', '2.0L Turbo EJ20')]},
        'Outback': {'years': range(2005, 2024), 'trims': [('2.5i', '2.5L FB25'), ('3.6R', '3.6L EZ36 V6')]},
        'Legacy': {'years': range(2005, 2023), 'trims': [('2.5i B-Sport', '2.5L FB25'), ('2.0GT', '2.0L Turbo')]},
        'Exiga': {'years': range(2008, 2019), 'trims': [('2.0i', '2.0L EJ20'), ('2.0GT', '2.0L Turbo')]},
    },
    'Honda': {
        'Fit': {'years': range(2005, 2024), 'trims': [('13G', '1.3L L13B'), ('RS', '1.5L L15B'), ('Hybrid', '1.5L Hybrid')]},
        'CR-V': {'years': range(2005, 2024), 'trims': [('EX', '2.0L R20A'), ('ZX', '2.4L K24A'), ('EX Turbo', '1.5L Turbo')]},
        'Vezel': {'years': range(2013, 2024), 'trims': [('X', '1.5L L15B'), ('Hybrid Z', '1.5L Hybrid')]},
        'Stepwgn': {'years': range(2005, 2024), 'trims': [('G', '2.0L R20A'), ('Spada', '1.5L Turbo')]},
        'Insight': {'years': range(2009, 2022), 'trims': [('G', '1.3L Hybrid'), ('EX', '1.5L Hybrid')]},
        'Freed': {'years': range(2008, 2024), 'trims': [('G', '1.5L L15A'), ('Hybrid', '1.5L Hybrid')]},
        'Stream': {'years': range(2005, 2015), 'trims': [('RSZ', '1.8L R18A'), ('ZS', '2.0L R20A')]},
    },
    'Mitsubishi': {
        'Pajero': {'years': range(2005, 2022), 'trims': [('Exceed', '3.2L DI-D Diesel'), ('Super Exceed', '3.8L V6 MIVEC')]},
        'Outlander': {'years': range(2005, 2024), 'trims': [('24G', '2.4L 4B12'), ('PHEV', '2.0L Plug-in Hybrid')]},
        'L200 / Triton': {'years': range(2005, 2024), 'trims': [('GLX', '2.5L DI-D'), ('Warrior', '2.4L MIVEC Diesel')]},
        'Canter': {'years': range(2005, 2024), 'trims': [('Guts', '3.0L Diesel'), ('FE', '4.9L Diesel')]},
        'RVR': {'years': range(2010, 2023), 'trims': [('G', '1.8L 4B10'), ('M', '1.8L')]},
    },
    'Suzuki': {
        'Escudo': {'years': range(2005, 2023), 'trims': [('XG', '2.4L J24B'), ('Salomon', '2.0L')]},
        'Swift': {'years': range(2005, 2024), 'trims': [('XG', '1.2L K12B'), ('RS', '1.2L'), ('Sport', '1.4L Turbo Boosterjet')]},
        'Jimny': {'years': range(2005, 2024), 'trims': [('XC', '0.66L Turbo'), ('Sierra JC', '1.5L K15B')]},
        'Carry': {'years': range(2005, 2024), 'trims': [('KC', '0.66L R06A'), ('KX', '0.66L')]},
    },
    'Mazda': {
        'Demio': {'years': range(2005, 2023), 'trims': [('13C', '1.3L ZJ-VE'), ('15S', '1.5L Skyactiv-G'), ('XD', '1.5L Skyactiv-D Diesel')]},
        'CX-5': {'years': range(2012, 2024), 'trims': [('20S', '2.0L Skyactiv-G'), ('XD L Package', '2.2L Skyactiv-D Diesel'), ('25S', '2.5L Skyactiv-G')]},
        'Axela': {'years': range(2005, 2023), 'trims': [('15S', '1.5L Skyactiv-G'), ('20S', '2.0L'), ('XD', '2.2L Diesel')]},
        'Atenza': {'years': range(2005, 2023), 'trims': [('25S', '2.5L Skyactiv-G'), ('XD', '2.2L Skyactiv-D Diesel')]},
        'Premacy': {'years': range(2005, 2019), 'trims': [('20S', '2.0L LF-VD'), ('20Z', '2.0L')]},
    },
    'Land Rover': {
        'Range Rover': {'years': range(2005, 2024), 'trims': [('HSE', '3.0L V6 Supercharged'), ('Autobiography', '5.0L V8 Supercharged'), ('Vogue', '4.4L SDV8 Diesel')]},
        'Range Rover Sport': {'years': range(2005, 2024), 'trims': [('HSE', '3.0L SDV6 Diesel'), ('SVR', '5.0L V8 Supercharged')]},
        'Discovery': {'years': range(2005, 2024), 'trims': [('SE', '3.0L SDV6 Diesel'), ('HSE Luxury', '3.0L Si6')]},
        'Defender': {'years': range(2005, 2024), 'trims': [('90', '2.2L Diesel'), ('110', '2.4L Puma Diesel'), ('110 X', '3.0L P400')]},
    },
    'Volkswagen': {
        'Golf': {'years': range(2005, 2024), 'trims': [('TSI', '1.4L Turbo'), ('GTI', '2.0L Turbo'), ('R', '2.0L Turbo 4Motion')]},
        'Touareg': {'years': range(2005, 2024), 'trims': [('V6', '3.0L TDI V6'), ('V8', '4.2L TDI V8')]},
        'Tiguan': {'years': range(2008, 2024), 'trims': [('Track & Field', '2.0L TSI'), ('R-Line', '2.0L TDI')]},
        'Amarok': {'years': range(2010, 2024), 'trims': [('Highline', '2.0L BiTDI'), ('Aventura', '3.0L V6 TDI')]},
    },
    'BMW': {
        'X5': {'years': range(2005, 2024), 'trims': [('xDrive30d', '3.0L Turbo Diesel'), ('xDrive40i', '3.0L Turbo'), ('X5 M', '4.4L Twin-Turbo V8')]},
        'X3': {'years': range(2005, 2024), 'trims': [('xDrive20d', '2.0L Turbo Diesel'), ('xDrive30i', '2.0L Turbo')]},
        '3 Series': {'years': range(2005, 2024), 'trims': [('320i', '2.0L Turbo'), ('320d', '2.0L Turbo Diesel'), ('330i', '2.0L Turbo')]},
        '5 Series': {'years': range(2005, 2024), 'trims': [('523i', '2.5L I6'), ('530i', '2.0L Turbo'), ('520d', '2.0L Turbo Diesel')]},
    },
    'Mercedes-Benz': {
        'C-Class': {'years': range(2005, 2024), 'trims': [('C200', '2.0L Turbo'), ('C250', '2.0L Turbo'), ('C220d', '2.1L Turbo Diesel')]},
        'E-Class': {'years': range(2005, 2024), 'trims': [('E250', '2.0L Turbo'), ('E350', '3.5L V6'), ('E220d', '2.0L Turbo Diesel')]},
        'GLE / ML': {'years': range(2005, 2024), 'trims': [('ML350', '3.5L V6'), ('GLE350d', '3.0L Turbo Diesel V6'), ('GLE450', '3.0L Turbo')]},
        'G-Class': {'years': range(2005, 2024), 'trims': [('G500', '4.0L V8 Twin-Turbo'), ('G63 AMG', '5.5L V8 BiTurbo')]},
    }
}

def guess_drivetrain(trim, make, model):
    if 'AWD' in trim or '4Motion' in trim or 'xDrive' in trim or '4WD' in trim: return 'AWD/4WD'
    if make in ['BMW', 'Mercedes-Benz'] and model not in ['X5', 'X3', 'GLE / ML', 'G-Class', 'Touareg', 'Tiguan', 'Amarok']: return 'RWD'
    if model in ['Land Cruiser Prado', 'Land Cruiser V8', 'Hilux', 'Patrol', 'Hardbody', 'Navara', 'Pajero', 'L200 / Triton', 'Jimny', 'Defender']: return '4WD'
    if model in ['Crown', 'Mark X', 'Brevis', 'Fuga', 'Mustang', 'Carry']: return 'RWD'
    if make == 'Subaru': return 'AWD'
    return 'FWD'

def guess_body(model):
    if model in ['Hilux', 'Hardbody', 'Navara', 'L200 / Triton', 'Amarok', 'Carry', 'Canter']: return 'Truck'
    if model in ['Hiace', 'Noah', 'Voxy', 'Alphard', 'Stepwgn', 'Freed', 'Serena']: return 'Van/Minivan'
    if model in ['Coaster']: return 'Bus'
    if model in ['Land Cruiser Prado', 'Land Cruiser V8', 'Harrier', 'Vanguard', 'RAV4', 'Dualis', 'X-Trail', 'Juke', 'Patrol', 'Forester', 'CR-V', 'Vezel', 'Pajero', 'Outlander', 'RVR', 'Escudo', 'Jimny', 'CX-5', 'Range Rover', 'Range Rover Sport', 'Discovery', 'Defender', 'Touareg', 'Tiguan', 'X5', 'X3', 'GLE / ML', 'G-Class']: return 'SUV'
    if model in ['IST', 'Vitz', 'Passo', 'Note', 'Tiida', 'March', 'Fit', 'Swift', 'Demio', 'Aqua', 'Golf', 'Auris']: return 'Hatchback'
    if model in ['Probox', 'Succeed', 'Corolla Fielder', 'Outback', 'Exiga']: return 'Wagon'
    return 'Sedan'

def generate():
    with open('/home/bea/uzaspea/backend/tanzania_vehicles_full.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['make', 'model', 'year', 'trim', 'engine', 'drivetrain', 'transmission', 'body_style', 'region'])
        
        for make, models in tz_cars.items():
            for model, details in models.items():
                for year in details['years']:
                    for trim, engine in details['trims']:
                        dt = guess_drivetrain(trim, make, model)
                        bs = guess_body(model)
                        
                        # Transmission guess
                        trans = 'Manual' if 'Manual' in trim else ('CVT' if 'CVT' in trim else 'Automatic')
                        if make in ['BMW', 'Mercedes-Benz', 'Land Rover']: trans = 'Automatic'
                        
                        writer.writerow([make, model, year, trim, engine, dt, trans, bs, 'JDM/TZ'])

if __name__ == '__main__':
    generate()
    print("CSV generated successfully!")
