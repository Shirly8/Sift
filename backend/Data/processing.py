import pandas as pd
from langdetect import detect, LangDetectException


#Filter only english
def is_english(text):
    try:
        return detect(text) == 'en'
    except LangDetectException:
        return False


def clean_xlxl(file_name):
    """ Clean the raw Excel file"""

    path_name = f"Raw/{file_name}"

    # Read the Excel file
    df = pd.read_excel(path_name)

    #drop empty reviews/duplicates or non english
    df = df = df.dropna(subset=['review_text'])
    df = df.drop_duplicates(subset=['review_text'])
    df = df[df['review_text'].str.len() >= 20]
    df = df[df['review_text'].apply(is_english)]


    #Extract the relevant columns
    resturant_name = df['name']
    review = df['review_text']
    rating = df['review_rating']
    date_raw = df['review_datetime_utc']

    #fix date
    date = date_raw.astype(str).str.split(" ", expand=True)[0]  # Keep only the date part, discard time

    #Write to csv
    output_path = f"{file_name.replace('.xlsx', '.csv')}"
    df_cleaned = pd.DataFrame({
        'restaurant': resturant_name,
        'review': review,
        'rating': rating,
        'date': date
    })

    df_cleaned.to_csv(output_path, index=False)



if __name__ == "__main__":
    
    clean_xlxl("Lavelle.xlsx")
    clean_xlxl("McDonalds.xlsx")
    clean_xlxl("360.xlsx")
    clean_xlxl("Pai.xlsx")



