"""
* num_labels = 3 (matches yangheng model neg/neu/pos)
"""

import torch
import pytorch_lightning as pl
from sklearn.metrics import f1_score
from transformers import AutoModelForSequenceClassification, get_linear_schedule_with_warmup


BASE_MODEL = "yangheng/deberta-v3-base-absa-v1.1"



####################################
# STEP 1: ABSA CLASSIFIER
####################################

class ABSAClassifier(pl.LightningModule):

    def __init__(self, learning_rate=2e-5, total_steps=1000):
        super().__init__()
        self.save_hyperparameters()

        #load pretrained ABSA deberta from HuggingFace
        self.model = AutoModelForSequenceClassification.from_pretrained(
            BASE_MODEL,
            num_labels=3   # 0=negative, 1=neutral, 2=positive
        )

        self.learning_rate = learning_rate
        self.total_steps = total_steps
        self.validation_step_outputs = []

    def forward(self, input_ids, attention_mask, labels=None):
        return self.model(input_ids=input_ids, attention_mask=attention_mask, labels=labels)



####################################
# STEP 2: TRAINING & VALIDATION
####################################

    def training_step(self, batch, batch_idx):
        outputs = self(
            input_ids=batch['input_ids'],
            attention_mask=batch['attention_mask'],
            labels=batch['label']       #dataloader uses 'label' not 'labels'
        )
        loss = outputs.loss
        self.log("train_loss", loss, on_step=True, on_epoch=True)
        return loss


    def validation_step(self, batch, batch_idx):
        outputs = self(
            input_ids=batch['input_ids'],
            attention_mask=batch['attention_mask'],
            labels=batch['label']
        )
        loss = outputs.loss
        preds = torch.argmax(outputs.logits, dim=1)

        self.log("val_loss", loss, prog_bar=True)
        self.validation_step_outputs.append({"preds": preds, "labels": batch['label']})
        return loss


    def on_validation_epoch_end(self):
        all_preds = torch.cat([x["preds"] for x in self.validation_step_outputs])
        all_labels = torch.cat([x["labels"] for x in self.validation_step_outputs])

        f1 = f1_score(all_labels.cpu(), all_preds.cpu(), average='weighted')
        self.log("val_f1", f1, prog_bar=True)

        self.validation_step_outputs.clear()



####################################
# STEP 3: OPTIMIZER
####################################

    def configure_optimizers(self):
        optimizer = torch.optim.AdamW(self.parameters(), lr=self.learning_rate)
        scheduler = get_linear_schedule_with_warmup(
            optimizer, num_warmup_steps=0, num_training_steps=self.total_steps
        )
        return [optimizer], [{'scheduler': scheduler, 'interval': 'step'}]



if __name__ == "__main__":

    model = ABSAClassifier()
    print(model.model.config.num_labels)   # should be 3
    print("Model loaded OK")
