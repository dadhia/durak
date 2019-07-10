
def generate_image_tags():
    for suit in 'cdsh':
        for i in range(2,11):
            print('<img src="{:s} url_for(\'static\', filename=\'playing_cards/simple_{:s}_{:d}.svg\') {:s}" id="card-{:s}{:d}" style="display: none;">'
                  .format('{{', suit, i, '}}', suit, i))
        for royal in 'jqka':
            print(
                '<img src="{:s} url_for(\'static\', filename=\'playing_cards/simple_{:s}_{:s}.svg\') {:s}" id="card-{:s}{:s}" style="display: none;">'
                    .format('{{', suit, royal, '}}', suit, royal))

if __name__ == "__main__":
    generate_image_tags()